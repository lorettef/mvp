from typing import Optional

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import get_current_user_optional
from app.models.analytics_event import AnalyticsEvent
from app.schemas.analytics import TrackEventRequest

router = APIRouter()


@router.post("/track", status_code=status.HTTP_202_ACCEPTED)
async def track_event(
    request: Request,
    data: TrackEventRequest,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[dict] = Depends(get_current_user_optional),
):
    """Запись события продуктовой аналитики (не требует авторизации)."""
    db.add(
        AnalyticsEvent(
            user_id=current_user["user_id"] if current_user else None,
            event=data.event,
            properties=data.properties,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    await db.flush()
    return {"detail": "ok"}
