from fastapi import Depends, HTTPException, status, Cookie, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.company import Company
from app.services.subscription_service import SubscriptionService
from app.services.audit_service import get_audit_action, write_audit_log

security = HTTPBearer(auto_error=False)

ROLE_ADMIN = "admin"
ROLE_COMPANY = "company"
ROLE_OBSERVER = "observer"

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None),
) -> dict:
    """Получает текущего пользователя из httpOnly cookie или JWT заголовка."""
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
) -> dict:
    """Загружает полную запись пользователя (role, organization_id, company_id)."""
    user = await db.get(User, current_user["user_id"])
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден"
        )

    return {
        **current_user,
        "role": user.role,
        "organization_id": user.organization_id,
        "company_id": user.company_id,
    }

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
        company = await db.get(Company, company_id)
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
