from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

DEFAULT_NDFL_RATE = 0.13
DEFAULT_INSURANCE_RATE = 0.30
DEFAULT_INJURY_RATE = 0.002


class HiringSettingsUpsert(BaseModel):
    """Настройки соц. платежей (редактируются клиентом)."""

    ndfl_rate: float = Field(DEFAULT_NDFL_RATE, ge=0, le=1)
    insurance_rate: float = Field(DEFAULT_INSURANCE_RATE, ge=0, le=1)
    injury_rate: float = Field(DEFAULT_INJURY_RATE, ge=0, le=1)


class HiringSettingsResponse(BaseModel):
    company_id: UUID
    ndfl_rate: float
    insurance_rate: float
    injury_rate: float
    total_rate: float  # сумма ставок


class HiringMonthRow(BaseModel):
    """Одна строка плана найма (месяц)."""

    month: int  # 1..12
    period: date
    mrr: float
    fot: float
    social_payments: float
    total_cost: float  # ФОТ + соц. платежи
    headcount: int
    dev_count: int
    sales_count: int
    marketing_count: int


class HiringPlanResponse(BaseModel):
    """Прогноз найма на 12 месяцев (TZ v5.0, раздел 10)."""

    company_id: UUID
    industry: str
    industry_label: str
    base_mrr: Optional[float] = None
    fot_share: float  # доля ФОТ от MRR (0.35)
    avg_salary: float  # средняя зарплата, ₽
    monthly_growth: float  # ежемесячный рост MRR (0.05)
    settings: HiringSettingsResponse
    months: List[HiringMonthRow]
    final_headcount: int
    summary: str
