from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import date, datetime


class CohortUpsert(BaseModel):
    period: date
    type: str
    size: int = Field(..., ge=1)
    retention_m1: float = Field(..., ge=0, le=1)
    retention_m2: float = Field(..., ge=0, le=1)
    retention_m3: float = Field(..., ge=0, le=1)
    retention_m4: float = Field(..., ge=0, le=1)
    retention_m5: float = Field(..., ge=0, le=1)
    retention_m6: float = Field(..., ge=0, le=1)
    retention_m7: float = Field(..., ge=0, le=1)
    retention_m8: float = Field(..., ge=0, le=1)
    retention_m9: float = Field(..., ge=0, le=1)
    retention_m10: float = Field(..., ge=0, le=1)
    retention_m11: float = Field(..., ge=0, le=1)
    retention_m12: float = Field(..., ge=0, le=1)
    marketing_spend: Optional[float] = Field(None, ge=0)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("plan", "fact"):
            raise ValueError("type должен быть 'plan' или 'fact'")
        return v


class CohortResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    period: date
    type: str
    size: int
    retention_m1: float
    retention_m2: float
    retention_m3: float
    retention_m4: float
    retention_m5: float
    retention_m6: float
    retention_m7: float
    retention_m8: float
    retention_m9: float
    retention_m10: float
    retention_m11: float
    retention_m12: float
    marketing_spend: Optional[float] = None
    created_at: datetime
    updated_at: datetime
