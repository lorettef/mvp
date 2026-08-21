from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class PnLResponse(BaseModel):
    """Отчёт о прибылях и убытках (TZ v5.0, раздел 11)."""

    company_id: UUID
    period: Optional[date] = None

    # Выручка
    mrr: Optional[float] = None
    one_time_revenue: float = 0.0
    revenue: Optional[float] = None

    # Операционные расходы
    fot: Optional[float] = None
    social_payments: Optional[float] = None
    marketing: Optional[float] = None
    development: Optional[float] = None
    gna: Optional[float] = None
    total_opex: Optional[float] = None

    # EBITDA и прибыль
    ebitda: Optional[float] = None
    financial_expenses: float = 0.0
    net_profit: Optional[float] = None

    # Маржа
    ebitda_margin: Optional[float] = None
    net_margin: Optional[float] = None

    summary: str
