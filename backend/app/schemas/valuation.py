from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class ValuationResponse(BaseModel):
    """Оценка бизнеса по модели Гордона (TZ v5.0, раздел 14)."""

    company_id: UUID
    geography: str
    key_rate: float
    discount_rate: float  # r = ключевая ставка + 10%
    growth_rate: float  # g = прогноз инфляции, %

    fcf: Optional[float] = None
    terminal_value: Optional[float] = None

    debt: float = 0.0
    cash: float = 0.0
    net_debt: float = 0.0
    equity_value: Optional[float] = None

    revenue_annual: Optional[float] = None
    ps_ratio: Optional[float] = None
    headcount: int = 0
    value_per_employee: Optional[float] = None

    summary: str
