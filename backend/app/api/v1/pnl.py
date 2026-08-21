import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.pnl import PnLResponse
from app.services.pnl_service import PnLService

router = APIRouter()


@router.get("/{company_id}/pnl", response_model=PnLResponse)
async def get_pnl(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Отчёт о прибылях и убытках (P&L)."""
    service = PnLService(db)
    return await service.get_pnl(company_id)
