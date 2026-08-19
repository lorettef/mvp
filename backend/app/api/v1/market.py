from fastapi import APIRouter, Depends

from app.api.dependencies import get_current_user
from app.schemas.market import MarketAnalysisRequest, MarketAnalysisResponse
from app.services.market_service import MarketAnalysisService

router = APIRouter()


@router.post("/analyze", response_model=MarketAnalysisResponse)
async def analyze_market(
    data: MarketAnalysisRequest,
    _user: dict = Depends(get_current_user),
):
    """Внешний анализ рынка (макро + объём рынка + тренды + влияние на метрики)."""
    return MarketAnalysisService().analyze(data)
