from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user_full, ROLE_ADMIN
from app.schemas.invite import InviteCreate, InviteResponse, InviteInfo
from app.services.invite_service import InviteService

router = APIRouter()


@router.post(
    "",
    response_model=InviteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite(
    data: InviteCreate,
    current_user: dict = Depends(get_current_user_full),
    db: AsyncSession = Depends(get_db),
):
    """Создаёт приглашение для стартапа (только администратор организации)."""
    if current_user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )
    if current_user["organization_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Пользователь не привязан к организации"
        )

    service = InviteService(db)
    result = await service.create_invite(
        current_user["organization_id"], data.email
    )
    return InviteResponse(**result)


@router.get("/{token}", response_model=InviteInfo)
async def get_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Публичная информация о приглашении по токену (без аутентификации)."""
    service = InviteService(db)
    result = await service.get_invite_info(token)
    return InviteInfo(**result)
