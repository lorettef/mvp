import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.credit import CreditForecastResponse
from app.services.credit_service import CreditService

router = APIRouter()


@router.get(
    "/{company_id}/credit-forecast", response_model=CreditForecastResponse
)
async def get_credit_forecast(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Умное прогнозирование кредитов (кассовые разрывы + сумма/ставка)."""
    service = CreditService(db)
    return await service.forecast(company_id)
