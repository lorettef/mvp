from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class RecalculateResponse(BaseModel):
    """Результат принудительного пересчёта всех прогнозов компании (TZ v5.0, раздел 18)."""

    company_id: UUID
    recalculated_at: datetime

    mrr: Optional[float] = None
    runway_months: Optional[float] = None
    ltv_cac: Optional[float] = None
    ebitda: Optional[float] = None
    net_profit: Optional[float] = None
    total_cf: Optional[float] = None
    equity_value: Optional[float] = None
    total_credit_needed: Optional[float] = None

    summary: str
