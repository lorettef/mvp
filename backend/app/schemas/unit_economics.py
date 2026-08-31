from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class RetentionBreakdown(BaseModel):
    """Удержание клиентов по когортам (M1/M3/M6/M12), доли 0..1."""

    m1: Optional[float] = None
    m3: Optional[float] = None
    m6: Optional[float] = None
    m12: Optional[float] = None


class UnitEconomicsResponse(BaseModel):
    """Сводка юнит-экономики компании (TZ v5.0, раздел 4)."""

    company_id: UUID

    # Базовые метрики (последний факт)
    revenue: Optional[float] = None
    cac: Optional[float] = None
    ltv: Optional[float] = None
    churn: Optional[float] = None  # 0..1

    # Производные
    ltv_cac: Optional[float] = None  # LTV / CAC (норма > 3)
    runway_months: Optional[float] = None  # Деньги / Месячные расходы
    cash: Optional[float] = None  # Сумма финансирования (investment + credit)
    monthly_burn: Optional[float] = None  # Сумма статей бюджета (факт)
    magic_number: Optional[float] = None  # Прирост дохода / Затраты на маркетинг (норма > 1)
    revenue_growth: Optional[float] = None  # ΔRevenue (последний − предыдущий факт)
    marketing_spend: Optional[float] = None  # Затраты на маркетинг (факт)
    payback_period: Optional[float] = None  # CAC / (ARPU × gross_margin), мес
    romi: Optional[float] = None  # (LTV − CAC) / CAC

    retention: RetentionBreakdown = RetentionBreakdown()

    alerts: List[str] = []
