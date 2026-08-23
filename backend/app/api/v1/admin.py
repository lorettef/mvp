from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_role, ROLE_ADMIN
from app.models.user import User
from app.services.email_service import send_email
from app.services.weekly_report_service import WeeklyReportService

router = APIRouter()


@router.post("/send-weekly-reports")
async def send_weekly_reports(
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Рассылка еженедельных отчётов всем администраторам (ручной/тестовый триггер)."""
    result = await db.execute(select(User).where(User.role == ROLE_ADMIN))
    admins = list(result.scalars().all())

    sent = 0
    for admin in admins:
        if not admin.organization_id or not admin.email:
            continue
        html = await WeeklyReportService(db).build_report_html(admin.organization_id)
        if await send_email(admin.email, "Еженедельный отчёт Startup Engine", html):
            sent += 1

    return {"sent": sent, "total": len(admins)}
