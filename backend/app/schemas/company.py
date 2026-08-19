from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class CompanyCreate(BaseModel):
    name: str = Field(..., max_length=255)
    industry: Optional[str] = None
    geography: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    geography: Optional[str] = None


class CompanyResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    industry: Optional[str]
    geography: Optional[str]
    created_at: datetime
