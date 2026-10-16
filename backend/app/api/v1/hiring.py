import uuid

from app.api.dependencies import require_company_access, require_company_source_write
from app.core.database import get_db
from app.schemas.hiring import (
    HiringApproveUpsert,
    HiringPlanResponse,
    HiringSettingsResponse,
    HiringSettingsUpsert,
    HiringTeamRow,
    HiringTeamUpsert,
)
from app.services.hiring_service import HiringService
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/{company_id}/hiring/settings", response_model=HiringSettingsResponse)
async def get_hiring_settings(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Текущие настройки соц. платежей (НДФЛ, взносы, травматизм)."""
    service = HiringService(db)
    return await service.get_settings(company_id)


@router.put("/{company_id}/hiring/settings", response_model=HiringSettingsResponse)
async def upsert_hiring_settings(
    company_id: uuid.UUID,
    data: HiringSettingsUpsert,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Обновить настройки соц. платежей (admin или company)."""
    service = HiringService(db)
    return await service.upsert_settings(company_id, data)


@router.get("/{company_id}/hiring/team", response_model=list[HiringTeamRow])
async def list_hiring_team(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Текущая команда по ролям."""
    service = HiringService(db)
    return await service.list_team(company_id)


@router.put("/{company_id}/hiring/team", response_model=HiringTeamRow)
async def upsert_hiring_team(
    company_id: uuid.UUID,
    data: HiringTeamUpsert,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Обновить текущую команду по роли (headcount + зарплата)."""
    service = HiringService(db)
    return await service.upsert_team(company_id, data)


@router.get("/{company_id}/hiring", response_model=HiringPlanResponse)
async def get_hiring_plan(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Прогноз найма на 12 месяцев (рекомендация + утверждённый план)."""
    service = HiringService(db)
    return await service.build_plan(company_id)


@router.post("/{company_id}/hiring/generate", response_model=HiringPlanResponse)
async def generate_hiring_plan(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Пересчитать и сохранить рекомендацию найма (admin или company)."""
    service = HiringService(db)
    return await service.generate_plan(company_id)


@router.put("/{company_id}/hiring/approve", response_model=HiringPlanResponse)
async def approve_hiring_plan(
    company_id: uuid.UUID,
    data: HiringApproveUpsert,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Утвердить наймы (approved_hires) — гибридная модель (admin или company)."""
    service = HiringService(db)
    return await service.approve_plan(company_id, data)
