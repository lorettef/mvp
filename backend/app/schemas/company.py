from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class CompanyCreate(BaseModel):
    name: str = Field(..., max_length=255)
    industry: Optional[str] = None
    geography: Optional[str] = None
    gross_margin: Optional[float] = Field(None, gt=0, le=1)


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    geography: Optional[str] = None
    gross_margin: Optional[float] = Field(None, gt=0, le=1)


class CompanyResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    industry: Optional[str]
    geography: Optional[str]
    gross_margin: float
    created_at: datetime
