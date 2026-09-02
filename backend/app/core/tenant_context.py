import uuid
from contextvars import ContextVar, Token
from typing import Optional

current_org_id: ContextVar[Optional[uuid.UUID]] = ContextVar("current_org_id", default=None)

def set_current_org(org_id: Optional[uuid.UUID]) -> Token:
    return current_org_id.set(org_id)

def reset_current_org(token: Token) -> None:
    current_org_id.reset(token)

def clear_current_org() -> None:
    current_org_id.set(None)
