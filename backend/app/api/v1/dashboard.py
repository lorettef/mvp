from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_role, ROLE_ADMIN
from app.schemas.dashboard import (
    DashboardFilters,
    DashboardHealth,
    DashboardPerformanceStatus,
    DashboardResponse,
    PerformancePoint,
)
from app.services.dashboard_service import DashboardService

router = APIRouter()


def dashboard_filters(
    company_id: list[UUID] = Query(
        default=[],
        description="Repeated IDs; active companies in the current tenant only",
    ),
    industry: list[str] = Query(
        default=[], description="Repeated industry slugs; OR within this selection"
    ),
    health: list[DashboardHealth] = Query(
        default=[], description="Repeated snapshot health statuses"
    ),
    performance_status: list[DashboardPerformanceStatus] = Query(
        default=[],
        description="Repeated Fact/Plan performance statuses, independent of health",
    ),
    period_from: date | None = Query(
        default=None,
        description="Inclusive lower bound for current Fact and series; cash and previous Fact are not truncated",
    ),
    period_to: date | None = Query(
        default=None,
        description="Inclusive as-of cutoff for metrics, budgets and dated financing",
    ),
) -> DashboardFilters:
    """Shared, explicitly named query contract for every portfolio endpoint."""
    try:
        return DashboardFilters(
            company_ids=company_id,
            industries=industry,
            health=health,
            performance_status=performance_status,
            period_from=period_from,
            period_to=period_to,
        )
    except ValidationError as exc:
        raise RequestValidationError(
            [
                {**error, "loc": ("query", *error["loc"])}
                for error in exc.errors(include_context=False)
            ]
        ) from exc


def _organization_id(user: dict) -> str:
    if user["organization_id"] is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="У пользователя нет привязанной организации",
        )
    return user["organization_id"]


@router.get("", response_model=DashboardResponse)
async def get_dashboard(
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
    filters: DashboardFilters = Depends(dashboard_filters),
):
    """Агрегированный дашборд портфеля организатора."""
    service = DashboardService(db)
    return await service.get_dashboard(_organization_id(user), filters)


@router.get("/performance", response_model=list[PerformancePoint])
async def get_dashboard_performance(
    months: int | None = Query(
        default=None,
        ge=1,
        le=24,
        description="Last N available periods after dates; omitted: six without dates, all within explicit dates",
    ),
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
    filters: DashboardFilters = Depends(dashboard_filters),
):
    """Агрегированная выручка портфеля (fact/plan) по последним месяцам."""
    service = DashboardService(db)
    return await service.get_performance(_organization_id(user), months, filters)
