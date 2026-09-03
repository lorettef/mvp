from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional
from uuid import UUID
from datetime import date, datetime


class CohortUpsert(BaseModel):
    period: date
    type: str
    size: int = Field(..., ge=1)
    retention_m1: Optional[float] = Field(None, ge=0, le=1)
    retention_m2: Optional[float] = Field(None, ge=0, le=1)
    retention_m3: Optional[float] = Field(None, ge=0, le=1)
    retention_m4: Optional[float] = Field(None, ge=0, le=1)
    retention_m5: Optional[float] = Field(None, ge=0, le=1)
    retention_m6: Optional[float] = Field(None, ge=0, le=1)
    retention_m7: Optional[float] = Field(None, ge=0, le=1)
    retention_m8: Optional[float] = Field(None, ge=0, le=1)
    retention_m9: Optional[float] = Field(None, ge=0, le=1)
    retention_m10: Optional[float] = Field(None, ge=0, le=1)
    retention_m11: Optional[float] = Field(None, ge=0, le=1)
    retention_m12: Optional[float] = Field(None, ge=0, le=1)
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
    retention_m1: Optional[float] = None
    retention_m2: Optional[float] = None
    retention_m3: Optional[float] = None
    retention_m4: Optional[float] = None
    retention_m5: Optional[float] = None
    retention_m6: Optional[float] = None
    retention_m7: Optional[float] = None
    retention_m8: Optional[float] = None
    retention_m9: Optional[float] = None
    retention_m10: Optional[float] = None
    retention_m11: Optional[float] = None
    retention_m12: Optional[float] = None
    marketing_spend: Optional[float] = None
    created_at: datetime
    updated_at: datetime
