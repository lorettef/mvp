import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.valuation import ValuationResponse
from app.services.valuation_service import ValuationService

router = APIRouter()


@router.get("/{company_id}/valuation", response_model=ValuationResponse)
async def get_valuation(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Оценка бизнеса по модели Гордона (TV, Equity Value, мультипликаторы)."""
    service = ValuationService(db)
    return await service.get_valuation(company_id)
