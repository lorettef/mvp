from datetime import date
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from app.core.time import utcnow
from app.models.metric import Metric
from app.schemas.metric import MetricUpsert


def _consecutive_months(prev: date, current: date) -> bool:
    """True if `current` is exactly one month after `prev`."""
    return (current.year - prev.year) * 12 + (current.month - prev.month) == 1


def _derived(data: MetricUpsert) -> tuple[float, float, float]:
    """Compute churn/ltv/cac from the raw input fields."""
    churn = round(1.0 - data.retention_rate, 4)
    ltv = round(data.arpu / churn, 2) if churn > 0 else round(data.arpu * 12, 2)
    cac = round(data.marketing_spend / data.new_units, 2) if data.new_units > 0 else 0.0
    return churn, ltv, cac


class MetricService:
    """Сервис управления метриками компании."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def upsert_metric(self, company_id: UUID, data: MetricUpsert) -> Metric:
        """Создание или обновление метрики за период."""
        churn, ltv, cac = _derived(data)

        result = await self.db.execute(
            select(Metric).where(
                Metric.company_id == company_id,
                Metric.period == data.period,
                Metric.type == data.type,
            )
        )
        metric = result.scalar_one_or_none()

        if metric:
            metric.new_units = data.new_units
            metric.arpu = data.arpu
            metric.revenue = data.revenue
            metric.marketing_spend = data.marketing_spend
            metric.retention_rate = data.retention_rate
            metric.churn = churn
            metric.ltv = ltv
            metric.cac = cac
            metric.comment = data.comment
            metric.updated_at = utcnow()
            await self.db.flush()
        else:
            metric = Metric(
                company_id=company_id,
                period=data.period,
                type=data.type,
                new_units=data.new_units,
                arpu=data.arpu,
                revenue=data.revenue,
                marketing_spend=data.marketing_spend,
                retention_rate=data.retention_rate,
                churn=churn,
                ltv=ltv,
                cac=cac,
                comment=data.comment,
            )
            self.db.add(metric)
            await self.db.flush()

        return metric

    async def bulk_upsert(
        self, company_id: UUID, items: list[MetricUpsert]
    ) -> list[Metric]:
        """Атомарный upsert нескольких метрик; вычисляет active_units (факт)."""
        ordered = sorted(items, key=lambda i: i.period)
        saved: list[Metric] = []
        prev_active: Optional[int] = None
        prev_period: Optional[date] = None

        # SAVEPOINT (not begin()): the session already holds an open transaction from access checks.
        async with self.db.begin_nested():
            for data in ordered:
                churn, ltv, cac = _derived(data)

                result = await self.db.execute(
                    select(Metric).where(
                        Metric.company_id == company_id,
                        Metric.period == data.period,
                        Metric.type == data.type,
                    )
                )
                metric = result.scalar_one_or_none()

                if metric:
                    metric.new_units = data.new_units
                    metric.arpu = data.arpu
                    metric.revenue = data.revenue
                    metric.marketing_spend = data.marketing_spend
                    metric.retention_rate = data.retention_rate
                    metric.churn = churn
                    metric.ltv = ltv
                    metric.cac = cac
                    metric.comment = data.comment
                    metric.updated_at = utcnow()
                else:
                    metric = Metric(
                        company_id=company_id,
                        period=data.period,
                        type=data.type,
                        new_units=data.new_units,
                        arpu=data.arpu,
                        revenue=data.revenue,
                        marketing_spend=data.marketing_spend,
                        retention_rate=data.retention_rate,
                        churn=churn,
                        ltv=ltv,
                        cac=cac,
                        comment=data.comment,
                    )
                    self.db.add(metric)

                if data.type == "plan":
                    metric.active_units = None
                else:
                    if (
                        prev_period is not None
                        and prev_active is not None
                        and _consecutive_months(prev_period, data.period)
                    ):
                        metric.active_units = (
                            round(prev_active * data.retention_rate) + data.new_units
                        )
                    else:
                        metric.active_units = data.new_units
                    prev_active = metric.active_units
                    prev_period = data.period

                await self.db.flush()
                saved.append(metric)

        return saved

    async def list_metrics(
        self,
        company_id: UUID,
        period: Optional[date] = None,
    ) -> list[Metric]:
        """Список метрик компании (опционально за период)."""
        query = select(Metric).where(Metric.company_id == company_id)
        if period is not None:
            query = query.where(Metric.period == period)

        query = query.order_by(Metric.period.desc(), Metric.type)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_metric(self, company_id: UUID, metric_id: UUID) -> None:
        """Удаление метрики компании (404, если не найдена или чужая)."""
        metric = await self.db.get(Metric, metric_id)
        if not metric or metric.company_id != company_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Метрика не найдена",
            )

        await self.db.delete(metric)
        await self.db.flush()
