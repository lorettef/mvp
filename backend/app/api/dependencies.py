from fastapi import Depends, HTTPException, status, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.core.tenant_context import set_current_org, reset_current_org
from app.models.user import User
from app.models.company import Company
from app.core.roles import ROLE_ADMIN, ROLE_COMPANY, ROLE_OBSERVER
from app.services.subscription_service import SubscriptionService
from app.services.audit_service import get_audit_action, write_audit_log

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
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется аутентификация"
        )

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истёкший токен"
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный токен"
        )

    return {"user_id": uuid.UUID(user_id) if isinstance(user_id, str) else user_id, "token": token}

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

    return {"user_id": uuid.UUID(user_id) if isinstance(user_id, str) else user_id, "token": token}

async def audit_action(
    request: Request,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Записывает действие пользователя в audit_log."""
    action = get_audit_action(request.url.path)
    if action:
        await write_audit_log(db, request, current_user["user_id"], action)

async def check_subscription_limit(
    user_id: str,
    db: AsyncSession
) -> bool:
    """Проверяет, не превышен ли лимит запросов."""
    service = SubscriptionService(db)
    return await service.check_limit(user_id)

async def get_current_user_full(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Загружает полную запись пользователя (role, organization_id, company_id).

    Yield-dependency: устанавливает tenant-контекст для глобального фильтра (S8)
    на время обработки запроса и СБРАСЫВАЕТ его (по токену ContextVar) в finally,
    чтобы контекст не протекал на следующий запрос в том же asyncio-таске.
    """
    user = await db.get(User, current_user["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )

    token = set_current_org(user.organization_id)
    try:
        yield {
            **current_user,
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
            detail="Пользователь не привязан к организации"
        )
    return organization_id

def require_role(*allowed: str):
    """Фабрика зависимостей: допускает только указанные роли."""
    async def _require_role(
        current_user: dict = Depends(get_current_user_full),
    ) -> dict:
        if current_user["role"] not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав"
            )
        return current_user
    return _require_role

def require_company_access():
    """Фабрика зависимостей: проверяет доступ пользователя к указанной компании."""
    async def _require_company_access(
        company_id: uuid.UUID,
        current_user: dict = Depends(get_current_user_full),
        db: AsyncSession = Depends(get_db),
    ) -> dict:
        # skip_tenant_filter: guard-запрос читает Company напрямую по id, чтобы
        # вернуть 403 (а не 404) при кросс-org доступе — явная org-проверка ниже
        # остаётся enforcement'ом.
        company = await db.get(Company, company_id, execution_options={"skip_tenant_filter": True})
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена"
            )

        if current_user["role"] == ROLE_ADMIN:
            if current_user["organization_id"] is None or company.organization_id != current_user["organization_id"]:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Недостаточно прав"
                )
        elif current_user["company_id"] != company_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав"
            )

        return current_user
    return _require_company_access
