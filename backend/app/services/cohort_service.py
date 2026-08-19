from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cohort import Cohort
from app.schemas.cohort import CohortUpsert


class CohortService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upsert_cohort(self, company_id: UUID, data: CohortUpsert) -> Cohort:
        result = await self.db.execute(
            select(Cohort).where(
                Cohort.company_id == company_id,
                Cohort.period == data.period,
                Cohort.type == data.type,
            )
        )
        cohort = result.scalar_one_or_none()

        if cohort:
            cohort.retention_m1 = data.retention_m1
            cohort.retention_m3 = data.retention_m3
            cohort.retention_m6 = data.retention_m6
            cohort.retention_m12 = data.retention_m12
            cohort.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.db.flush()
        else:
            cohort = Cohort(
                company_id=company_id,
                period=data.period,
                type=data.type,
                retention_m1=data.retention_m1,
                retention_m3=data.retention_m3,
                retention_m6=data.retention_m6,
                retention_m12=data.retention_m12,
            )
            self.db.add(cohort)
            await self.db.flush()

        return cohort

    async def list_cohorts(
        self, company_id: UUID, period: Optional[date] = None
    ) -> list[Cohort]:
        query = select(Cohort).where(Cohort.company_id == company_id)
        if period is not None:
            query = query.where(Cohort.period == period)
        query = query.order_by(Cohort.period.desc(), Cohort.type)

        result = await self.db.execute(query)
        return list(result.scalars().all())
