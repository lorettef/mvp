from pydantic import BaseModel, ConfigDict, Field, field_validator
from uuid import UUID
from datetime import date, datetime


class BudgetUpsert(BaseModel):
    period: date
    type: str
    marketing: float = Field(..., ge=0)
    development: float = Field(..., ge=0)
    fot: float = Field(..., ge=0)
    gna: float = Field(..., ge=0)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in ("plan", "fact"):
            raise ValueError("type должен быть 'plan' или 'fact'")
        return v


class BudgetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    period: date
    type: str
    marketing: float
    development: float
    fot: float
    gna: float
    created_at: datetime
    updated_at: datetime
