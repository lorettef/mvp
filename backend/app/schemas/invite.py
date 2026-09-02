from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class InviteCreate(BaseModel):
    email: Optional[str] = None

class InviteResponse(BaseModel):
    token: str
    expires_at: datetime
    email: Optional[str]

class InviteInfo(BaseModel):
    organization_name: str
    email: Optional[str]
