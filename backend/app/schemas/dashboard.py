from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class CompanyStatusItem(BaseModel):
    id: UUID
    name: str
    industry: Optional[str]
    geography: Optional[str]
    status: str  # "on_track" | "behind" | "no_plan" | "no_data"
    latest_revenue: Optional[float]
    latest_plan_revenue: Optional[float]
    task_progress: Optional[int] = None  # % выполненных задач (None, если нет задач)


class DashboardResponse(BaseModel):
    total_companies: int
    avg_revenue: Optional[float]
    avg_cac: Optional[float]
    avg_ltv: Optional[float]
    avg_churn: Optional[float]
    on_track: int
    behind: int
    no_plan: int
    no_data: int
    companies: list[CompanyStatusItem]
