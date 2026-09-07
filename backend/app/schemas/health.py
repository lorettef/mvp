from uuid import UUID

from pydantic import BaseModel


class HealthSignal(BaseModel):
    """Один детерминированный сигнал состояния бизнеса."""

    key: str  # revenue | retention | cac | burn | runway
    direction: str  # up | down | flat | unknown
    status: str  # good | bad | neutral | unknown
    label: str  # человекочитаемое описание (рус.)


class BusinessHealthResponse(BaseModel):
    """Состояние бизнеса компании — детерминированные сигналы, без composite score."""

    company_id: UUID
    status: str  # healthy | attention | critical | no_data
    signals: list[HealthSignal]
    summary: str
