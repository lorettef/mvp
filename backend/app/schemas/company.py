from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class CompanyCreate(BaseModel):
    name: str = Field(..., max_length=255)
    industry: Optional[str] = None
    geography: Optional[str] = None
    gross_margin: Optional[float] = Field(None, gt=0, le=1)
    business_model: Optional[str] = None
    selected_metrics: Optional[list[str]] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    geography: Optional[str] = None
    gross_margin: Optional[float] = Field(None, gt=0, le=1)
    business_model: Optional[str] = None
    selected_metrics: Optional[list[str]] = None


class CompanyResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    organization_id: UUID
    name: str
    industry: Optional[str]
    geography: Optional[str]
    gross_margin: float
    business_model: Optional[str] = None
    selected_metrics: Optional[list[str]] = None
    archived_at: Optional[datetime] = None
    created_at: datetime
