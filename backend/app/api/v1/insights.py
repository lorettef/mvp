import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.core.database import get_db
from app.api.dependencies import (
    check_subscription_limit,
    require_company_access,
    ROLE_ADMIN,
    ROLE_COMPANY,
)
from app.schemas.insight import InsightResponse, InsightScenario
from app.services.insight_service import InsightService

router = APIRouter()


@router.post(
    "/{company_id}/insights/{scenario}",
    response_model=InsightResponse,
)
@limiter.limit("30/minute")
async def get_insight(
    request: Request,
    company_id: uuid.UUID,
    scenario: InsightScenario,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """AI-нарратив по модулю компании (TZ v5.0, раздел 2.3)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )

    if not await check_subscription_limit(user["user_id"], db):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен дневной лимит AI-запросов",
        )

    return await InsightService(db).narrate(company_id, scenario, user["user_id"])
