from pydantic import BaseModel
from typing import List, Optional
from app.schemas.metrics import MetricsRequest

class RecommendationAction(BaseModel):
    title: str
    description: str
    priority: str  # high, medium, low
    category: str  # marketing, product, sales, retention

class RecommendationRequest(BaseModel):
    metrics: MetricsRequest
    history: Optional[List[dict]] = None  # История метрик

class RecommendationResponse(BaseModel):
    summary: str
    recommendations: List[RecommendationAction]
    raw_response: Optional[str] = None
    provider: str = "demo"  # deepseek | gigachat | demo
