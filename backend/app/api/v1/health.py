import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access
from app.schemas.health import BusinessHealthResponse
from app.services.health_service import HealthService

router = APIRouter()


@router.get("/{company_id}/health", response_model=BusinessHealthResponse)
async def get_company_health(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Детерминированное состояние бизнеса компании (сигналы + статус)."""
    return await HealthService(db).get_health(company_id)
