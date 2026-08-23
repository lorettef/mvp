from fastapi import APIRouter, Depends
from app.schemas.metrics import MetricsRequest, MetricsResponse
from app.services.analytics_service import AnalyticsService
from app.api.dependencies import get_current_user, audit_action

router = APIRouter()

@router.post("/analyze", response_model=MetricsResponse)
async def analyze_metrics(
    data: MetricsRequest,
    current_user: dict = Depends(get_current_user),
    _audit: None = Depends(audit_action),
):
    """Анализ метрик юнит-экономики.

    Детерминированное локальное вычисление (не AI-запрос), поэтому
    AI-лимит не применяется — только аутентификация и аудит.
    """
    return AnalyticsService.analyze_metrics(data)
