from datetime import date
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

DEFAULT_NDFL_RATE = 0.13
DEFAULT_INSURANCE_RATE = 0.30
DEFAULT_INJURY_RATE = 0.002
DEFAULT_EMPLOYER_RATE = round(DEFAULT_INSURANCE_RATE + DEFAULT_INJURY_RATE, 4)  # 0.302


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
    total_rate: float  # НДФЛ + страховые взносы + травматизм (employee-side burden)
    employer_rate: float  # страховые взносы + травматизм (employer cost, ~30.2%)


class HiringTeamUpsert(BaseModel):
    """Текущая команда: одна роль (headcount + средняя зарплата)."""

    role_key: str
    headcount: int = Field(..., ge=0)
    salary: float = Field(150000.0, gt=0)


class HiringTeamRow(BaseModel):
    role_key: str
    headcount: int
    salary: float


class HiringRolePlan(BaseModel):
    """План по одной роли за месяц."""

    role_key: str
    label: str
    group: str
    required_headcount: int
    recommended_hires: int
    approved_hires: int
    salary: float
    employer_cost: float  # месячный employer cost одного сотрудника


class HiringMonthPlan(BaseModel):
    """План найма за один месяц."""

    period: date
    roles: List[HiringRolePlan]
    total_required: int
    total_approved: int
    payroll: float  # ФОТ + employer cost по полному штату (текущая команда + одобренные)
    hires_payroll: float  # инкрементальная payroll от одобренного найма (кумулятивно)


class HiringApproveItem(BaseModel):
    period: date
    role_key: str
    approved_hires: int = Field(..., ge=0)


class HiringApproveUpsert(BaseModel):
    items: List[HiringApproveItem]


class HiringPlanResponse(BaseModel):
    """Прогноз найма на 12 месяцев (role-based, TZ v5.0, раздел 10)."""

    company_id: UUID
    forecast_start: Optional[date] = None
    settings: HiringSettingsResponse
    team: List[HiringTeamRow]
    months: List[HiringMonthPlan]
    final_headcount: int
    summary: str
