import uuid
from typing import Optional

from app.core.config import settings
from app.core.database import get_db
from app.core.product_roles import resolve_product_role
from app.core.roles import (
    ROLE_ADMIN as ROLE_ADMIN,
)
from app.core.roles import (
    ROLE_COMPANY as ROLE_COMPANY,
)
from app.core.roles import (
    ROLE_OBSERVER as ROLE_OBSERVER,
)
from app.core.security import decode_access_token
from app.core.tenant_context import reset_current_org, set_current_org
from app.models.company import Company
from app.models.organization import Organization
from app.models.user import User
from app.services.audit_service import get_audit_action, write_audit_log
from app.services.subscription_service import SubscriptionService
from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None),
) -> dict:
    """Получает текущего пользователя из httpOnly cookie или JWT заголовка.

    Двухканальный контракт аутентификации — оба канала равнозначны и
    одинаково доверенны:

    - Браузер: JWT передаётся в httpOnly cookie `access_token`
      (параметр `access_token`, читается через `Cookie("access_token")`).
    - API/CLI: JWT передаётся в заголовке `Authorization: Bearer <token>`
      (параметр `credentials`, через HTTPBearer).

    Приоритет отдаётся cookie; при её отсутствии используется Bearer-заголовок.
    """
    token = None

    if access_token:
        token = access_token
    elif credentials:
        token = credentials.credentials

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Требуется аутентификация"
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истёкший токен",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный токен"
        )

    return {
        "user_id": uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        "token": token,
    }


async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None),
) -> Optional[dict]:
    """Как get_current_user, но возвращает None при отсутствии/невалидном токене."""
    token = access_token or (credentials.credentials if credentials else None)

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    return {
        "user_id": uuid.UUID(user_id) if isinstance(user_id, str) else user_id,
        "token": token,
    }


async def audit_action(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Записывает действие пользователя в audit_log."""
    action = get_audit_action(request.url.path)
    if action:
        await write_audit_log(db, request, current_user["user_id"], action)


async def consume_subscription_limit(user_id: str, db: AsyncSession) -> bool:
    """Central application AI-quota gate.

    Subscription plans and usage fields remain available for billing/product
    work, while the pilot can disable enforcement without endpoint-specific
    branches. Provider limits are handled later by ``AIService``.
    """
    if not settings.AI_QUOTA_ENABLED:
        return True
    service = SubscriptionService(db)
    return await service.try_consume_ai_limit(user_id)


async def get_current_user_full(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загружает полную запись пользователя (role, organization_id, company_id).

    Yield-dependency: устанавливает tenant-контекст для глобального фильтра (S8)
    на время обработки запроса и СБРАСЫВАЕТ его (по токену ContextVar) в finally,
    чтобы контекст не протекал на следующий запрос в том же asyncio-таске.
    """
    # Authentication identity is selected by signed subject, before tenant context.
    # Join the binding too: role resolution must not add per-request lookups.
    identity = (
        await db.execute(
            select(User, Organization, Company)
            .outerjoin(Organization, User.organization_id == Organization.id)
            .outerjoin(Company, User.company_id == Company.id)
            .where(User.id == current_user["user_id"])
            .execution_options(skip_tenant_filter=True)
        )
    ).first()
    user, organization, bound_company = identity if identity else (None, None, None)
    if not user:
        raise HTTPException(401, "Пользователь не найден")
    product_context = {
        "product_role": resolve_product_role(user, organization, bound_company),
        "organization_type": organization.organization_type if organization else None,
    }
    token = set_current_org(user.organization_id)
    try:
        yield {
            **current_user,
            **product_context,
            "role": user.role,
            "organization_id": user.organization_id,
            "company_id": user.company_id,
        }
    finally:
        reset_current_org(token)


async def get_current_org(
    current_user: dict = Depends(get_current_user_full),
) -> uuid.UUID:
    """Возвращает organization_id текущего пользователя.

    Требует, чтобы пользователь был привязан к организации.
    """
    organization_id = current_user.get("organization_id")
    if organization_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не привязан к организации",
        )
    return organization_id


def require_role(*allowed: str):
    """Фабрика зависимостей: допускает только указанные роли."""

    async def _require_role(
        current_user: dict = Depends(get_current_user_full),
    ) -> dict:
        if current_user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав"
            )
        return current_user

    return _require_role


def require_product_role(*allowed: str):
    async def policy(current_user: dict = Depends(get_current_user_full)) -> dict:
        if current_user.get("product_role") not in allowed:
            raise HTTPException(403, "Недостаточно прав")
        return current_user

    return policy


require_portfolio_read = require_product_role("fund", "investor")
require_company_list_read = require_product_role("fund", "investor")
require_fund_invite = require_product_role("fund")
require_portfolio_ai = require_product_role("fund")


async def require_initial_company(
    user: dict = Depends(require_product_role("startup")),
) -> dict:
    if (
        user["role"] != "admin"
        or user["organization_type"] != "startup"
        or user["company_id"] is not None
    ):
        raise HTTPException(403, "Компания уже привязана или создание недоступно")
    return user


def require_company_access():
    """Company-detail/module read: tenant fund or the startup's exact binding."""

    async def policy(
        company_id: uuid.UUID,
        current_user: dict = Depends(get_current_user_full),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        product_role = current_user.get("product_role")
        if product_role not in ("fund", "startup"):
            raise HTTPException(403, "Недостаточно прав")
        if product_role == "startup" and current_user["company_id"] != company_id:
            raise HTTPException(403, "Недостаточно прав")
        company = await db.get(
            Company, company_id, execution_options={"skip_tenant_filter": True}
        )
        if not company:
            raise HTTPException(404, "Компания не найдена")
        if (
            current_user["organization_id"] is None
            or company.organization_id != current_user["organization_id"]
        ):
            raise HTTPException(403, "Недостаточно прав")
        return current_user

    return policy


async def require_company_source_write(
    user: dict = Depends(require_company_access()),
) -> dict:
    if user["product_role"] != "startup":
        raise HTTPException(403, "Недостаточно прав")
    return user


async def require_company_ai(user: dict = Depends(require_company_access())) -> dict:
    return user


async def require_company_lifecycle(
    user: dict = Depends(require_company_access()),
) -> dict:
    # Preserve existing Fund lifecycle; startup/investor get no global lifecycle.
    if user["product_role"] != "fund":
        raise HTTPException(403, "Недостаточно прав")
    return user
