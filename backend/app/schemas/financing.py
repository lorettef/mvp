from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class FinancingCreate(BaseModel):
    """Создание записи финансирования (investment или loan)."""

    type: Literal["investment", "loan"]
    investor_type: Optional[Literal["founder", "fund"]] = None
    counterparty_name: Optional[str] = None
    amount: float = Field(..., gt=0)
    currency: str = "RUB"
    issued_date: Optional[date] = None
    annual_rate: Optional[float] = Field(None, ge=0)
    term_months: Optional[int] = Field(None, gt=0)
    repayment_type: Optional[str] = "annuity"
    first_payment_date: Optional[date] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_consistency(self) -> "FinancingCreate":
        if self.type == "investment":
            if self.investor_type is None:
                raise ValueError("investment требует investor_type (founder|fund)")
            if self.annual_rate is not None or self.term_months is not None:
                raise ValueError("investment не может иметь annual_rate/term_months")
        if self.type == "loan":
            if self.investor_type is not None:
                raise ValueError("loan не может иметь investor_type")
            if self.annual_rate is None:
                raise ValueError("loan требует annual_rate")
            if self.term_months is None:
                raise ValueError("loan требует term_months > 0")
        return self


class FinancingUpdate(BaseModel):
    """Частичное обновление записи финансирования (PATCH)."""

    investor_type: Optional[Literal["founder", "fund"]] = None
    counterparty_name: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    currency: Optional[str] = None
    issued_date: Optional[date] = None
    annual_rate: Optional[float] = Field(None, ge=0)
    term_months: Optional[int] = Field(None, gt=0)
    repayment_type: Optional[str] = None
    first_payment_date: Optional[date] = None
    notes: Optional[str] = None


class FinancingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    type: str
    investor_type: Optional[str] = None
    counterparty_name: Optional[str] = None
    amount: float
    currency: str
    issued_date: Optional[date] = None
    annual_rate: Optional[float] = None
    term_months: Optional[int] = None
    repayment_type: Optional[str] = None
    first_payment_date: Optional[date] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
