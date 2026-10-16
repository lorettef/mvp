import uuid

from app.api.dependencies import (
    consume_subscription_limit,
    require_company_source_write,
)
from app.core.database import get_db
from app.core.limiter import limiter
from app.schemas.recommendation_tasks import RecommendationTasksResponse
from app.services.recommendation_task_service import RecommendationTaskService
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post(
    "/{company_id}/recommendations",
    response_model=RecommendationTasksResponse,
)
@limiter.limit("30/minute")
async def generate_company_recommendations(
    request: Request,
    company_id: uuid.UUID,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """AI-рекомендации по компании с авто-конвертацией в задачи (дедупликация)."""

    if not await consume_subscription_limit(user["user_id"], db):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен дневной лимит AI-запросов",
        )

    return await RecommendationTaskService(db).generate_and_convert(
        company_id, user["user_id"]
    )
