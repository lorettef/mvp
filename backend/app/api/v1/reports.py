import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.services.report_service import ReportService

router = APIRouter()


@router.get("/{company_id}/report/pdf")
async def report_pdf(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Отчёт для инвесторов в формате PDF."""
    service = ReportService(db)
    content = await service.build_pdf(company_id)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="investor_report.pdf"'},
    )


@router.get("/{company_id}/report/excel")
async def report_excel(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Отчёт для инвесторов в формате Excel."""
    service = ReportService(db)
    content = await service.build_excel(company_id)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="investor_report.xlsx"'},
    )
