from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.limiter import limiter
from app.core.database import get_db
from app.schemas.recommendations import RecommendationRequest, RecommendationResponse
from app.services.ai_service import AIService
from app.api.dependencies import get_current_user, check_subscription_limit, audit_action

router = APIRouter()

@router.post("/get", response_model=RecommendationResponse)
@limiter.limit("30/minute")
async def get_recommendations(
    request: Request,
    data: RecommendationRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _audit: None = Depends(audit_action),
):
    """Получить AI-рекомендации на основе метрик."""
    # Проверка лимита запросов
    limit_check = await check_subscription_limit(current_user["user_id"], db)
    if not limit_check:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен дневной лимит AI-запросов"
        )
    
    ai_service = AIService(db)
    return await ai_service.get_recommendations(data.metrics, current_user["user_id"])
