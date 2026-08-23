from typing import Optional

from pydantic import BaseModel


class TrackEventRequest(BaseModel):
    """Событие продуктовой аналитики."""

    event: str
    properties: Optional[dict] = None
