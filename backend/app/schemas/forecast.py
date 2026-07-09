from pydantic import BaseModel, Field
from typing import List, Optional

class ForecastRequest(BaseModel):
    """Запрос на прогнозирование."""
    history: List[float] = Field(..., max_length=1000, description="История MRR по месяцам (макс. 1000)")
    months: int = Field(6, ge=1, le=24, description="Количество месяцев прогноза")
    method: str = Field("polynomial", description="linear | polynomial | prophet")

class ForecastResponse(BaseModel):
    """Ответ с прогнозом."""
    predictions: List[float]
    confidence_interval: Optional[dict] = None  # Для продвинутого прогноза
    method: str
