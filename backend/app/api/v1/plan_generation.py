import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.limiter import limiter
from app.core.database import get_db
from app.api.dependencies import (
    check_subscription_limit,
    require_company_access,
    ROLE_ADMIN,
    ROLE_COMPANY,
)
from app.schemas.plan import PlanGenerateResponse
from app.services.plan_generation_service import PlanGenerationService

router = APIRouter()


@router.post("/{company_id}/generate-plan", response_model=PlanGenerateResponse)
@limiter.limit("30/minute")
async def generate_plan(
    request: Request,
    company_id: uuid.UUID,
    months: int = Query(6, ge=1, le=24),
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Генерация плана метрик на основе фактической истории (TZ v5.0, раздел 7.1)."""
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

    return await PlanGenerationService(db).generate(
        company_id, user["user_id"], months
    )
