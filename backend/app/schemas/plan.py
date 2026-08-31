from datetime import date
from typing import List
from uuid import UUID

from pydantic import BaseModel


class PlanMetricItem(BaseModel):
    """Одна строка сгенерированного плана метрик."""

    period: date
    new_units: int
    arpu: float
    revenue: float
    marketing_spend: float
    retention_rate: float


class PlanGenerateResponse(BaseModel):
    """Результат генерации плана метрик (TZ v5.0, раздел 7.1)."""

    company_id: UUID
    provider: str  # deepseek | gigachat | demo
    summary: str
    metrics: List[PlanMetricItem]
