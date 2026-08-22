from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class Scenario(BaseModel):
    """Сценарий оценки: базовый или консервативный."""

    equity_value: Optional[float] = None
    terminal_value: Optional[float] = None
    fcf: Optional[float] = None
    growth_rate: Optional[float] = None
    mrr: Optional[float] = None
    cac: Optional[float] = None
    ltv: Optional[float] = None
    churn: Optional[float] = None
    ltv_cac: Optional[float] = None


class SensitivityResponse(BaseModel):
    """Анализ чувствительности (TZ v5.0, раздел 15)."""

    company_id: UUID
    geography: str
    key_rate: float
    discount_rate: float
    base: Scenario
    conservative: Scenario
    equity_delta: Optional[float] = None
    equity_delta_pct: Optional[float] = None
    summary: str
