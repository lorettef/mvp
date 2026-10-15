from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import ROLE_ADMIN, consume_subscription_limit, require_role
from app.api.v1.dashboard import dashboard_filters
from app.core.database import get_db
from app.core.limiter import limiter
from app.models.organization import Organization
from app.schemas.dashboard import DashboardFilters
from app.schemas.insight import PortfolioInsightResponse
from app.services.portfolio_insight_service import PortfolioInsightService

router = APIRouter()


@router.post("/portfolio", response_model=PortfolioInsightResponse)
@limiter.limit("30/minute")
async def portfolio_insight(
    request: Request,
    filters: DashboardFilters = Depends(dashboard_filters),
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    organization_id = user.get("organization_id")
    if not organization_id:
        raise HTTPException(403, "Нет доступа к портфелю")
    organization = await db.get(Organization, organization_id)
    if organization is None or organization.organization_type == "startup":
        raise HTTPException(403, "Нет доступа к портфелю")
    if not await consume_subscription_limit(user["user_id"], db):
        raise HTTPException(429, "Превышен дневной лимит AI-запросов")
    return await PortfolioInsightService(db).narrate(organization_id, filters)
