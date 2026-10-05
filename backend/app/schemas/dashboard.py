from datetime import date
from typing import Literal, Optional, Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

DashboardHealth = Literal["healthy", "attention", "critical", "no_data"]
DashboardPerformanceStatus = Literal["on_track", "behind", "no_plan", "no_data"]


class DashboardFilters(BaseModel):
    """OR within each selection; AND between filters. Active tenant companies only.

    Dates are inclusive. The lower bound selects the current Fact, but does not
    truncate previous Fact or accumulated cash. The upper bound is a snapshot
    cutoff for metrics, budgets and dated financing.
    """

    model_config = ConfigDict(frozen=True)

    company_ids: list[UUID] = Field(default_factory=list)
    industries: list[str] = Field(default_factory=list)
    health: list[DashboardHealth] = Field(default_factory=list)
    performance_status: list[DashboardPerformanceStatus] = Field(default_factory=list)
    period_from: Optional[date] = None
    period_to: Optional[date] = None

    @model_validator(mode="after")
    def valid_range(self) -> Self:
        if self.period_from and self.period_to and self.period_from > self.period_to:
            raise ValueError("period_from must be on or before period_to")
        return self


class DashboardMetricSnapshot(BaseModel):
    """Stored metric values, not another calculation engine."""

    model_config = ConfigDict(from_attributes=True)

    period: date
    revenue: float
    new_units: int
    arpu: Optional[float]
    marketing_spend: float
    retention_rate: float
    churn: float
    ltv: float
    cac: float


class AttentionSignal(BaseModel):
    """Конкретная причина, почему компания требует внимания (детерминированная)."""

    kind: str  # behind_plan | retention_declining | cac_rising | burn_exceeds_revenue | runway_low | no_data | no_plan
    label: str  # человекочитаемое описание (рус.)
    severity: str  # critical | warning | info


class CompanyStatusItem(BaseModel):
    id: UUID
    name: str
    industry: Optional[str]
    geography: Optional[str]
    business_model: Optional[str] = None
    status: str  # "on_track" | "behind" | "no_plan" | "no_data"
    latest_revenue: Optional[float]
    latest_plan_revenue: Optional[float]
    revenue_growth: Optional[float] = None  # MoM (последний vs предыдущий факт)
    runway_months: Optional[float] = None
    last_update: Optional[date] = None  # период последнего факта/плана
    health: str = "unknown"  # healthy | attention | critical | no_data
    attention: list[AttentionSignal] = []
    task_progress: Optional[int] = None  # % выполненных задач (None, если нет задач)
    fact: Optional[DashboardMetricSnapshot] = None
    plan: Optional[DashboardMetricSnapshot] = None


class IndustryProfitabilityItem(BaseModel):
    """Snapshot Fact EBITDA / Fact revenue for companies with matching Fact budgets."""

    industry: Optional[str]
    revenue: float
    total_opex: float
    ebitda: float
    ebitda_margin: Optional[float]
    companies_total: int
    companies_included: int


class DashboardResponse(BaseModel):
    total_companies: int
    avg_revenue: Optional[float]
    avg_cac: Optional[float]
    avg_ltv: Optional[float]
    avg_churn: Optional[float]
    portfolio_revenue: Optional[float] = None  # сумма latest fact revenue
    revenue_growth: Optional[float] = None  # портфельный MoM-рост (сумма фактов)
    companies_at_risk: int = 0  # health in (attention, critical)
    avg_runway: Optional[float] = None
    companies_without_data: int = 0  # синоним no_data (нет фактов)
    on_track: int
    behind: int
    no_plan: int
    no_data: int
    companies: list[CompanyStatusItem]
    profitability_by_industry: list[IndustryProfitabilityItem] = Field(
        default_factory=list
    )


class PerformancePoint(BaseModel):
    """Один месяц агрегированной (портфель) или одиночной выручки."""

    month: str  # "YYYY-MM"
    fact: Optional[float] = None
    plan: Optional[float] = None
