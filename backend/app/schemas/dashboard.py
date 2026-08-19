from pydantic import BaseModel
from uuid import UUID
from typing import Optional


class CompanyStatusItem(BaseModel):
    id: UUID
    name: str
    industry: Optional[str]
    geography: Optional[str]
    status: str  # "on_track" | "behind" | "no_plan" | "no_data"
    latest_mrr: Optional[float]
    latest_plan_mrr: Optional[float]


class DashboardResponse(BaseModel):
    total_companies: int
    avg_mrr: Optional[float]
    avg_cac: Optional[float]
    avg_ltv: Optional[float]
    avg_churn: Optional[float]
    on_track: int
    behind: int
    no_plan: int
    no_data: int
    companies: list[CompanyStatusItem]
