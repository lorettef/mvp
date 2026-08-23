import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.recalculate import RecalculateResponse
from app.services.recalculate_service import RecalculateService

router = APIRouter()


@router.post("/{company_id}/recalculate", response_model=RecalculateResponse)
async def recalculate(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Принудительный пересчёт всех прогнозов компании (TZ v5.0, раздел 18)."""
    return await RecalculateService(db).recalculate(company_id)
