from pydantic import BaseModel, Field, field_validator
from uuid import UUID
from datetime import date, datetime


class CohortUpsert(BaseModel):
    period: date
    type: str
    retention_m1: float = Field(..., ge=0, le=1)
    retention_m3: float = Field(..., ge=0, le=1)
    retention_m6: float = Field(..., ge=0, le=1)
    retention_m12: float = Field(..., ge=0, le=1)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("plan", "fact"):
            raise ValueError("type должен быть 'plan' или 'fact'")
        return v


class CohortResponse(BaseModel):
    id: UUID
    company_id: UUID
    period: date
    type: str
    retention_m1: float
    retention_m3: float
    retention_m6: float
    retention_m12: float
    created_at: datetime
    updated_at: datetime
