from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


class InviteCreate(BaseModel):
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value


class InviteResponse(BaseModel):
    token: str
    expires_at: datetime
    email: Optional[str]


class InviteInfo(BaseModel):
    organization_name: str
    email: Optional[str]
