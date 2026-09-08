from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class CashFlowMonth(BaseModel):
    """Cash Flow за один месяц (период)."""

    period: date
    net_profit: Optional[float] = None
    operating_cf: Optional[float] = None
    investing_cf: float = 0.0
    financing_cf: float = 0.0
    total_cf: Optional[float] = None
    closing_balance: Optional[float] = None


class CashFlowResponse(BaseModel):
    """Отчёт о движении денежных средств (TZ v5.0, раздел 12)."""

    company_id: UUID
    period: Optional[date] = None

    # Операционный CF
    net_profit: Optional[float] = None
    amortization: float = 0.0
    operating_cf: Optional[float] = None

    # Инвестиционный CF
    capex: float = 0.0
    investing_cf: float = 0.0

    # Финансовый CF
    investments: float = 0.0
    credits: float = 0.0
    financing_cf: float = 0.0

    # Итого
    total_cf: Optional[float] = None
    opening_balance: float = 0.0
    closing_balance: Optional[float] = None

    summary: str

    # Помесячная разбивка (horizon)
    months: List[CashFlowMonth] = []
