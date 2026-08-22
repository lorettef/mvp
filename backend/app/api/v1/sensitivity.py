import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.sensitivity import SensitivityResponse
from app.services.sensitivity_service import SensitivityService

router = APIRouter()


@router.get(
    "/{company_id}/sensitivity", response_model=SensitivityResponse
)
async def get_sensitivity(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Анализ чувствительности оценки (консервативный сценарий)."""
    service = SensitivityService(db)
    return await service.analyze(company_id)
