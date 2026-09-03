import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import (
    get_current_user_full,
    require_role,
    require_company_access,
    ROLE_ADMIN,
    ROLE_COMPANY,
)
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from app.schemas.metric import MetricUpsert, MetricResponse, MetricBulkUpsert
from app.services.company_service import CompanyService
from app.services.metric_service import MetricService
from app.services.subscription_service import SubscriptionService
from app.core.plans import company_limit
from app.models.task import Task
from app.models.hiring_plan import HiringPlan
from app.models.hiring_settings import HiringSettings
from app.models.financing import Financing
from app.models.valuation import Valuation
from app.models.metric import Metric
from app.models.cohort import Cohort
from app.models.budget import Budget
from app.models.user import User

router = APIRouter()


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CompanyCreate,
    user: dict = Depends(require_role(ROLE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Создание компании в организации администратора."""
    service = CompanyService(db)
    plan_id = await SubscriptionService(db).get_plan_id(user["user_id"])
    limit = company_limit(plan_id)
    if limit is not None:
        count = await service.count_companies(user["organization_id"])
        if count >= limit:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Превышен лимит компаний по тарифу (максимум {limit}).",
            )
    company = await service.create_company(user["organization_id"], data)
    return CompanyResponse.model_validate(company)


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    archived: bool = False,
    user: dict = Depends(get_current_user_full),
    db: AsyncSession = Depends(get_db),
):
    """Список компаний, доступных пользователю (archived=True — архивные)."""
    service = CompanyService(db)
    companies = await service.list_companies(user, archived=archived)
    return [CompanyResponse.model_validate(c) for c in companies]


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Получение компании по идентификатору."""
    service = CompanyService(db)
    company = await service.get_company(company_id)
    return CompanyResponse.model_validate(company)


@router.patch("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: uuid.UUID,
    data: CompanyUpdate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Обновление данных компании (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = CompanyService(db)
    company = await service.get_company(company_id)
    company = await service.update_company(company, data)
    return CompanyResponse.model_validate(company)


@router.delete("/{company_id}")
async def delete_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Удаление компании (только admin).

    Зависимые записи удаляются ЯВНО, а не только через DB-level CASCADE:
    SQLite в этом проекте не включает `PRAGMA foreign_keys`, поэтому полагаться
    на FK-каскад нельзя — явные delete гарантируют отсутствие orphan-строк.
    """
    if user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = CompanyService(db)
    company = await service.get_company(company_id)

    # Явное каскадное удаление зависимых строк (порядок важен из-за FK-ссылок).
    for model in (Task, HiringPlan, HiringSettings, Financing, Valuation, Metric, Cohort, Budget):
        await db.execute(delete(model).where(model.company_id == company_id))

    # Отвязываем пользователей от удаляемой компании (SET NULL).
    await db.execute(
        update(User).where(User.company_id == company_id).values(company_id=None)
    )

    await service.delete_company(company)
    return {"detail": "ok"}


@router.post("/{company_id}/archive", response_model=CompanyResponse)
async def archive_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Архивация компании (только admin)."""
    if user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = CompanyService(db)
    company = await service.get_company(company_id)
    company = await service.archive_company(company)
    return CompanyResponse.model_validate(company)


@router.post("/{company_id}/restore", response_model=CompanyResponse)
async def restore_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Восстановление компании из архива (только admin)."""
    if user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = CompanyService(db)
    company = await service.get_company(company_id)
    company = await service.restore_company(company)
    return CompanyResponse.model_validate(company)


@router.put("/{company_id}/metrics", response_model=MetricResponse)
async def upsert_metric(
    company_id: uuid.UUID,
    data: MetricUpsert,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Создание или обновление метрики компании (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = MetricService(db)
    metric = await service.upsert_metric(company_id, data)
    return MetricResponse.model_validate(metric)


@router.put("/{company_id}/metrics/bulk", response_model=list[MetricResponse])
async def upsert_metrics_bulk(
    company_id: uuid.UUID,
    data: MetricBulkUpsert,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Массовое создание или обновление метрик компании (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = MetricService(db)
    metrics = await service.bulk_upsert(company_id, data.items)
    return [MetricResponse.model_validate(m) for m in metrics]


@router.get("/{company_id}/metrics", response_model=list[MetricResponse])
async def list_metrics(
    company_id: uuid.UUID,
    period: Optional[date] = None,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Список метрик компании."""
    service = MetricService(db)
    metrics = await service.list_metrics(company_id, period)
    return [MetricResponse.model_validate(m) for m in metrics]
