import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.cashflow import CashFlowResponse
from app.services.cashflow_service import CashFlowService

router = APIRouter()


@router.get("/{company_id}/cashflow", response_model=CashFlowResponse)
async def get_cashflow(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Отчёт о движении денежных средств (Cash Flow)."""
    service = CashFlowService(db)
    return await service.get_cashflow(company_id)
