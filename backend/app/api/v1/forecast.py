from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.limiter import limiter
from app.core.database import get_db
from app.schemas.forecast import ForecastRequest, ForecastResponse
from app.services.forecast_service import ForecastService
from app.api.dependencies import get_current_user, check_subscription_limit, audit_action

router = APIRouter()

@router.post("/predict", response_model=ForecastResponse)
@limiter.limit("30/minute")
async def predict(
    request: Request,
    data: ForecastRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _audit: None = Depends(audit_action),
):
    """Прогнозирование MRR на основе истории."""
    # Проверка лимита запросов
    limit_ok = await check_subscription_limit(current_user["user_id"], db)
    if not limit_ok:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Дневной лимит AI-запросов превышен",
        )

    service = ForecastService()
    return await service.predict(data)
