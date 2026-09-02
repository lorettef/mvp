from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID
from datetime import date, datetime
from typing import Optional


class MetricUpsert(BaseModel):
    period: date
    type: str
    new_units: int = Field(..., ge=0)
    arpu: float = Field(..., gt=0)
    revenue: float = Field(..., ge=0)
    marketing_spend: float = Field(..., ge=0)
    retention_rate: float = Field(..., ge=0, le=1)
    comment: Optional[str] = None

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("plan", "fact"):
            raise ValueError("type должен быть 'plan' или 'fact'")
        return v


class MetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    period: date
    type: str
    new_units: int
    arpu: float
    revenue: float
    marketing_spend: float
    retention_rate: float
    churn: float
    ltv: float
    cac: float
    active_units: Optional[int]
    comment: Optional[str]
    created_at: datetime
    updated_at: datetime


class MetricBulkUpsert(BaseModel):
    items: list[MetricUpsert]

    @field_validator("items")
    @classmethod
    def validate_items_non_empty(cls, v: list[MetricUpsert]) -> list[MetricUpsert]:
        if not v:
            raise ValueError("items не должен быть пустым")
        return v
