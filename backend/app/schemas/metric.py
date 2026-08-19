from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import date, datetime
from typing import Optional


class MetricUpsert(BaseModel):
    period: date
    type: str
    mrr: float = Field(..., gt=0)
    cac: float = Field(..., gt=0)
    ltv: float = Field(..., gt=0)
    churn: float = Field(..., ge=0, le=1)
    arpu: Optional[float] = Field(None, gt=0)
    runway_months: Optional[float] = Field(None, gt=0)
    stage: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("plan", "fact"):
            raise ValueError("type должен быть 'plan' или 'fact'")
        return v


class MetricResponse(BaseModel):
    id: UUID
    company_id: UUID
    period: date
    type: str
    mrr: float
    cac: float
    ltv: float
    churn: float
    arpu: Optional[float]
    runway_months: Optional[float]
    stage: Optional[str]
    created_at: datetime
    updated_at: datetime
