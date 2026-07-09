from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.metrics import MetricsRequest, MetricsResponse
from app.services.analytics_service import AnalyticsService
from app.services.subscription_service import SubscriptionService
from app.api.dependencies import get_current_user, audit_action

router = APIRouter()

@router.post("/analyze", response_model=MetricsResponse)
async def analyze_metrics(
    data: MetricsRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _audit: None = Depends(audit_action),
):
    """Анализ метрик юнит-экономики."""
    # Проверка лимита запросов
    sub_service = SubscriptionService(db)
    limit_ok = await sub_service.check_limit(current_user["user_id"])
    if not limit_ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Превышен дневной лимит запросов к аналитике"
        )
    
    return AnalyticsService.analyze_metrics(data)