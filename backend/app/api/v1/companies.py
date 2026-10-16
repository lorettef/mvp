import uuid
from datetime import date
from typing import Optional

from app.api.dependencies import (
    ROLE_ADMIN,
    require_company_access,
    require_company_lifecycle,
    require_company_list_read,
    require_company_source_write,
    require_initial_company,
)
from app.core.database import get_db
from app.models.budget import Budget
from app.models.comment import Comment
from app.models.correction import Correction
from app.models.cohort import Cohort
from app.models.financing import Financing
from app.models.hiring_plan import HiringPlan
from app.models.hiring_settings import HiringSettings
from app.models.metric import Metric
from app.models.task import Task
from app.models.user import User
from app.models.valuation import Valuation
from app.schemas.company import CompanyCreate, CompanyResponse, CompanyUpdate
from app.schemas.metric import MetricBulkUpsert, MetricResponse, MetricUpsert
from app.services.company_service import CompanyService
from app.services.metric_service import MetricService
from app.services.subscription_service import SubscriptionService
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    data: CompanyCreate,
    user: dict = Depends(require_initial_company),
    db: AsyncSession = Depends(get_db),
):
    """Создание компании доступно только администратору стартапа."""
    # Serialize initial provisioning on the owner, including concurrent requests.
    owner = await db.scalar(
        select(User)
        .where(User.id == user["user_id"])
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if (
        owner is None
        or owner.role != ROLE_ADMIN
        or user["organization_type"] != "startup"
        or owner.company_id is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Создание компании доступно только до привязки собственной компании",
        )
    service = CompanyService(db)
    plan_id = await SubscriptionService(db).get_plan_id(user["user_id"])
    await service.enforce_company_limit(user["organization_id"], plan_id)
    company = await service.create_company(user["organization_id"], data)
    owner.company_id = company.id
    await db.flush()
    return CompanyResponse.model_validate(company)


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    archived: bool = False,
    user: dict = Depends(require_company_list_read),
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
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Обновление данных компании (admin или company)."""

    service = CompanyService(db)
    company = await service.get_company(company_id)
    company = await service.update_company(company, data)
    return CompanyResponse.model_validate(company)


@router.delete("/{company_id}")
async def delete_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_lifecycle),
    db: AsyncSession = Depends(get_db),
):
    """Удаление компании (только admin).

    Зависимые записи удаляются ЯВНО, а не только через DB-level CASCADE:
    SQLite в этом проекте не включает `PRAGMA foreign_keys`, поэтому полагаться
    на FK-каскад нельзя — явные delete гарантируют отсутствие orphan-строк.
    """

    service = CompanyService(db)
    company = await service.get_company(company_id)

    # Явное каскадное удаление зависимых строк (порядок важен из-за FK-ссылок).
    for model in (
        Comment,
        Correction,
        Task,
        HiringPlan,
        HiringSettings,
        Financing,
        Valuation,
        Metric,
        Cohort,
        Budget,
    ):
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
    user: dict = Depends(require_company_lifecycle),
    db: AsyncSession = Depends(get_db),
):
    """Архивация компании (только admin)."""

    service = CompanyService(db)
    company = await service.get_company(company_id)
    company = await service.archive_company(company)
    return CompanyResponse.model_validate(company)


@router.post("/{company_id}/restore", response_model=CompanyResponse)
async def restore_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_lifecycle),
    db: AsyncSession = Depends(get_db),
):
    """Восстановление компании из архива (только admin)."""

    service = CompanyService(db)
    company = await service.get_company(company_id)
    company = await service.restore_company(company)
    return CompanyResponse.model_validate(company)


@router.put("/{company_id}/metrics", response_model=MetricResponse)
async def upsert_metric(
    company_id: uuid.UUID,
    data: MetricUpsert,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Создание или обновление метрики компании (admin или company)."""

    service = MetricService(db)
    metric = await service.upsert_metric(company_id, data)
    return MetricResponse.model_validate(metric)


@router.put("/{company_id}/metrics/bulk", response_model=list[MetricResponse])
async def upsert_metrics_bulk(
    company_id: uuid.UUID,
    data: MetricBulkUpsert,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Массовое создание или обновление метрик компании (admin или company)."""

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


@router.delete("/{company_id}/metrics/{metric_id}")
async def delete_metric(
    company_id: uuid.UUID,
    metric_id: uuid.UUID,
    user: dict = Depends(require_company_source_write),
    db: AsyncSession = Depends(get_db),
):
    """Удаление метрики компании (admin или company)."""

    service = MetricService(db)
    await service.delete_metric(company_id, metric_id)
    return {"detail": "ok"}
