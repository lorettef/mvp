from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class CashProjectionMonth(BaseModel):
    """Один месяц Cash Flow прогноза."""

    month: int
    period: date
    revenue: float
    opex: float
    net_cf: float
    balance_before: float
    balance_after: float


class CreditGap(BaseModel):
    """Зафиксированный кассовый разрыв и требуемый кредит."""

    month: int
    period: date
    balance_before: float
    gap: float
    credit_amount: float
    rate: float


class CreditForecastResponse(BaseModel):
    """Умное прогнозирование кредитов (TZ v5.0, раздел 13)."""

    company_id: UUID
    geography: str
    key_rate: float
    credit_rate: float
    opening_cash: float
    base_revenue: Optional[float] = None
    base_opex: Optional[float] = None
    months: List[CashProjectionMonth]
    gaps: List[CreditGap]
    total_credit_needed: float
    summary: str
