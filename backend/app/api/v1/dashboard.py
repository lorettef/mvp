from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_role, ROLE_ADMIN
from app.schemas.dashboard import DashboardResponse
from app.services.dashboard_service import DashboardService

router = APIRouter()


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Агрегированный дашборд портфеля организатора."""
    if user["organization_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У пользователя нет привязанной организации"
        )

    service = DashboardService(db)
    return await service.get_dashboard(user["organization_id"])
