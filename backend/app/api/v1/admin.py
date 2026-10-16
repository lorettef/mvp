from app.api.dependencies import ROLE_ADMIN, require_product_role
from app.core.database import get_db
from app.models.user import User
from app.services.email_service import send_email
from app.services.weekly_report_service import WeeklyReportService
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/send-weekly-reports")
async def send_weekly_reports(
    user: dict = Depends(require_product_role("fund")),
    db: AsyncSession = Depends(get_db),
):
    """Рассылка еженедельных отчётов всем администраторам (ручной/тестовый триггер)."""
    if user["organization_id"] is None:
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    result = await db.execute(
        select(User).where(
            User.role == ROLE_ADMIN,
            User.organization_id == user["organization_id"],
        )
    )
    admins = list(result.scalars().all())

    sent = 0
    for admin in admins:
        if not admin.organization_id or not admin.email:
            continue
        html = await WeeklyReportService(db).build_report_html(admin.organization_id)
        if await send_email(
            admin.email, "Еженедельный отчёт Startup Investment Bridge", html
        ):
            sent += 1

    return {"sent": sent, "total": len(admins)}
