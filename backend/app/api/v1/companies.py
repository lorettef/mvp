import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
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

router = APIRouter()


def _company_to_response(company) -> CompanyResponse:
    return CompanyResponse(
        id=company.id,
        organization_id=company.organization_id,
        name=company.name,
        industry=company.industry,
        geography=company.geography,
        gross_margin=company.gross_margin,
        created_at=company.created_at,
    )


def _metric_to_response(metric) -> MetricResponse:
    return MetricResponse(
        id=metric.id,
        company_id=metric.company_id,
        period=metric.period,
        type=metric.type,
        new_units=metric.new_units,
        arpu=float(metric.arpu),
        revenue=float(metric.revenue),
        marketing_spend=float(metric.marketing_spend),
        retention_rate=float(metric.retention_rate),
        churn=float(metric.churn),
        ltv=float(metric.ltv),
        cac=float(metric.cac),
        active_units=metric.active_units,
        comment=metric.comment,
        created_at=metric.created_at,
        updated_at=metric.updated_at,
    )


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
    return _company_to_response(company)


@router.get("", response_model=list[CompanyResponse])
async def list_companies(
    user: dict = Depends(get_current_user_full),
    db: AsyncSession = Depends(get_db),
):
    """Список компаний, доступных пользователю."""
    service = CompanyService(db)
    companies = await service.list_companies(user)
    return [_company_to_response(c) for c in companies]


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Получение компании по идентификатору."""
    service = CompanyService(db)
    company = await service.get_company(company_id)
    return _company_to_response(company)


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
    return _company_to_response(company)


@router.delete("/{company_id}")
async def delete_company(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Удаление компании (только admin)."""
    if user["role"] != ROLE_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав"
        )

    service = CompanyService(db)
    company = await service.get_company(company_id)
    await service.delete_company(company)
    return {"detail": "ok"}


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
    return _metric_to_response(metric)


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
    return [_metric_to_response(m) for m in metrics]


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
    return [_metric_to_response(m) for m in metrics]
