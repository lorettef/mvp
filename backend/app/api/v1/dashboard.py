from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_role, ROLE_ADMIN
from app.schemas.dashboard import DashboardResponse, PerformancePoint
from app.services.dashboard_service import DashboardService

router = APIRouter()


def _organization_id(user: dict) -> str:
    if user["organization_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У пользователя нет привязанной организации"
        )
    return user["organization_id"]


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Агрегированный дашборд портфеля организатора."""
    service = DashboardService(db)
    return await service.get_dashboard(_organization_id(user))


@router.get("/performance", response_model=list[PerformancePoint])
async def get_dashboard_performance(
    months: int = Query(default=6, ge=1, le=24),
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Агрегированная выручка портфеля (fact/plan) по последним месяцам."""
    service = DashboardService(db)
    return await service.get_performance(_organization_id(user), months)
