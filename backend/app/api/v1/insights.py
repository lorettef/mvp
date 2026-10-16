import uuid

from app.api.dependencies import (
    consume_subscription_limit,
    require_company_ai,
)
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.insight import InsightResponse, InsightScenario
from app.services.insight_service import InsightService
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

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
    user: dict = Depends(require_company_ai),
    db: AsyncSession = Depends(get_db),
):
    """AI-нарратив по модулю компании (TZ v5.0, раздел 2.3)."""

    if not await consume_subscription_limit(user["user_id"], db):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен дневной лимит AI-запросов",
        )

    return await InsightService(db).narrate(company_id, scenario, user["user_id"])
