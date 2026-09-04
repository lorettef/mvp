from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from uuid import UUID
from datetime import datetime
from typing import Optional, Literal
import re

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: Optional[str] = Field(None, max_length=255)
    company_name: Optional[str] = Field(None, max_length=255)
    account_type: Literal["fund", "startup"] = "fund"
    invite_token: Optional[str] = None
    industry: Optional[str] = Field(None, max_length=100)
    geography: Optional[str] = Field(None, max_length=100)

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        if not re.search(r"[A-Z]", v):
            raise ValueError("Пароль должен содержать хотя бы одну заглавную букву")
        if not re.search(r"[a-z]", v):
            raise ValueError("Пароль должен содержать хотя бы одну строчную букву")
        if not re.search(r"\d", v):
            raise ValueError("Пароль должен содержать хотя бы одну цифру")
        return v

    @model_validator(mode="after")
    def validate_company_name_required(self) -> "UserCreate":
        if self.invite_token or self.account_type == "startup":
            if not self.company_name or not self.company_name.strip():
                raise ValueError("company_name required")
        return self

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    token_type: str = "bearer"
    expires_in: int

class UserResponse(BaseModel):
    id: UUID
    email: str
    full_name: Optional[str]
    company_name: Optional[str]
    role: str
    organization_id: Optional[UUID]
    company_id: Optional[UUID]
    created_at: datetime
    subscription_plan: str
    daily_limit: Optional[int] = None  # None — безлимит
    used_today: int
    organization_type: Optional[str] = None
