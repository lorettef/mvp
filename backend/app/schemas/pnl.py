from datetime import date
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.unit_economics import UnitEconomicsMetricSource


class PnLBudgetSource(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    period: date
    type: Literal["plan", "fact"]
    marketing: float
    development: float
    fot: float
    gna: float


class PnLScenario(BaseModel):
    """Strict same-type sources; missing inputs remain null, never fall back."""

    metric_source: Optional[UnitEconomicsMetricSource] = None
    budget_source: Optional[PnLBudgetSource] = None
    revenue: Optional[float] = None
    fot: Optional[float] = None
    social_payments: Optional[float] = None
    marketing: Optional[float] = None
    development: Optional[float] = None
    gna: Optional[float] = None
    total_opex: Optional[float] = None
    ebitda: Optional[float] = None
    financial_expenses: Optional[float] = None
    net_profit: Optional[float] = None
    ebitda_margin: Optional[float] = None
    net_margin: Optional[float] = None


class PnLPeriod(BaseModel):
    period: date
    plan: Optional[PnLScenario] = None
    fact: Optional[PnLScenario] = None


class PnLMonth(BaseModel):
    """P&L за один месяц (период)."""

    period: date
    source: Optional[str] = None  # fact | plan | mixed | None (missing)
    mrr: Optional[float] = None
    revenue: Optional[float] = None
    fot: Optional[float] = None
    social_payments: Optional[float] = None
    marketing: Optional[float] = None
    development: Optional[float] = None
    gna: Optional[float] = None
    total_opex: Optional[float] = None
    ebitda: Optional[float] = None
    financial_expenses: float = 0.0
    net_profit: Optional[float] = None
    profit_tax: float = 0.0  # налог на прибыль НЕ моделируется (net_profit — до налога)
    ebitda_margin: Optional[float] = None
    net_margin: Optional[float] = None


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
    profit_tax: float = 0.0  # налог на прибыль НЕ моделируется (net_profit — до налога)

    # Маржа
    ebitda_margin: Optional[float] = None
    net_margin: Optional[float] = None

    summary: str

    # Поквартальная/помесячная разбивка (horizon)
    months: List[PnLMonth] = []

    # Matrix: latest N union periods, including future Plan, chronological.
    periods: List[PnLPeriod] = Field(default_factory=list)
