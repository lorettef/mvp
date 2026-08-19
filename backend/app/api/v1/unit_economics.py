import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.unit_economics import UnitEconomicsResponse
from app.services.unit_economics_service import UnitEconomicsService

router = APIRouter()


@router.get(
    "/{company_id}/unit-economics", response_model=UnitEconomicsResponse
)
async def get_unit_economics(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Сводка юнит-экономики компании (Runway, Retention, LTV/CAC, Magic Number)."""
    service = UnitEconomicsService(db)
    return await service.get_unit_economics(company_id)
