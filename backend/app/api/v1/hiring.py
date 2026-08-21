import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access, ROLE_ADMIN, ROLE_COMPANY
from app.schemas.hiring import (
    HiringPlanResponse,
    HiringSettingsResponse,
    HiringSettingsUpsert,
)
from app.services.hiring_service import HiringService

router = APIRouter()


@router.get(
    "/{company_id}/hiring/settings", response_model=HiringSettingsResponse
)
async def get_hiring_settings(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Текущие настройки соц. платежей (НДФЛ, взносы, травматизм)."""
    service = HiringService(db)
    return await service.get_settings(company_id)


@router.put(
    "/{company_id}/hiring/settings", response_model=HiringSettingsResponse
)
async def upsert_hiring_settings(
    company_id: uuid.UUID,
    data: HiringSettingsUpsert,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Обновить настройки соц. платежей (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    service = HiringService(db)
    return await service.upsert_settings(company_id, data)


@router.get("/{company_id}/hiring", response_model=HiringPlanResponse)
async def get_hiring_plan(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Прогноз найма на 12 месяцев (пересчитывается при каждом запросе)."""
    service = HiringService(db)
    return await service.generate_plan(company_id)
