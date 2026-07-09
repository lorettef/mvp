import logging
from datetime import datetime, timezone
from uuid import UUID
from app.models.audit_log import AuditLog
from app.core.security import decode_access_token

logger = logging.getLogger(__name__)

AUDITABLE_PREFIXES = {
    "/api/v1/auth/login": "login",
    "/api/v1/auth/register": "register",
    "/api/v1/metrics/analyze": "metrics_analyze",
    "/api/v1/recommendations/get": "ai_recommendations",
    "/api/v1/forecast/predict": "forecast_predict",
}


def get_audit_action(path: str) -> str | None:
    """Возвращает имя действия для аудита по пути запроса."""
    for prefix, action in AUDITABLE_PREFIXES.items():
        if path.startswith(prefix):
            return action
    return None


async def write_audit_log(db, request, user_id: UUID, action: str) -> None:
    """Записывает событие в audit_log."""
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        db.add(entry)
        await db.flush()
    except Exception:
        logger.warning("Audit log write failed", exc_info=True)
