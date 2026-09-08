import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.cashflow import CashFlowResponse
from app.services.cashflow_service import CashFlowService

router = APIRouter()


@router.get("/{company_id}/cashflow", response_model=CashFlowResponse)
async def get_cashflow(
    company_id: uuid.UUID,
    months: int = Query(12, ge=1, le=36),
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Отчёт о движении денежных средств (Cash Flow) за N последних месяцев."""
    service = CashFlowService(db)
    return await service.get_cashflow(company_id, months=months)
