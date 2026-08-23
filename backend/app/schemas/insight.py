from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class InsightScenario(str, Enum):
    unit_economics = "unit_economics"
    cohorts = "cohorts"
    budget = "budget"
    readiness = "readiness"
    hiring = "hiring"
    pnl = "pnl"
    cashflow = "cashflow"
    credit = "credit"
    valuation = "valuation"
    sensitivity = "sensitivity"
    reports = "reports"


class InsightResponse(BaseModel):
    """AI-инсайт (нарратив) по модулю компании (TZ v5.0, раздел 2.3)."""

    company_id: UUID
    scenario: str
    provider: str  # deepseek | gigachat | demo
    text: str
