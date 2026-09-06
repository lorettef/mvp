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
from app.schemas.recommendation_tasks import RecommendationTasksResponse
from app.services.recommendation_task_service import RecommendationTaskService

router = APIRouter()


@router.post(
    "/{company_id}/recommendations",
    response_model=RecommendationTasksResponse,
)
@limiter.limit("30/minute")
async def generate_company_recommendations(
    request: Request,
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """AI-рекомендации по компании с авто-конвертацией в задачи (дедупликация)."""
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

    return await RecommendationTaskService(db).generate_and_convert(
        company_id, user["user_id"]
    )
