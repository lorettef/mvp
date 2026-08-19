from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metric import Metric
from app.schemas.metric import MetricUpsert


class MetricService:
    """Сервис управления метриками компании."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def upsert_metric(self, company_id: UUID, data: MetricUpsert) -> Metric:
        """Создание или обновление метрики за период."""
        result = await self.db.execute(
            select(Metric).where(
                Metric.company_id == company_id,
                Metric.period == data.period,
                Metric.type == data.type,
            )
        )
        metric = result.scalar_one_or_none()

        if metric:
            metric.mrr = data.mrr
            metric.cac = data.cac
            metric.ltv = data.ltv
            metric.churn = data.churn
            metric.arpu = data.arpu
            metric.runway_months = data.runway_months
            metric.stage = data.stage
            metric.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.db.flush()
        else:
            metric = Metric(
                company_id=company_id,
                period=data.period,
                type=data.type,
                mrr=data.mrr,
                cac=data.cac,
                ltv=data.ltv,
                churn=data.churn,
                arpu=data.arpu,
                runway_months=data.runway_months,
                stage=data.stage,
            )
            self.db.add(metric)
            await self.db.flush()

        return metric

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
