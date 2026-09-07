from datetime import date
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


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


class PerformancePoint(BaseModel):
    """Один месяц агрегированной (портфель) или одиночной выручки."""

    month: str  # "YYYY-MM"
    fact: Optional[float] = None
    plan: Optional[float] = None
