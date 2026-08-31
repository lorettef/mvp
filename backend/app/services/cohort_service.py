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
            cohort.size = data.size
            cohort.retention_m1 = data.retention_m1
            cohort.retention_m2 = data.retention_m2
            cohort.retention_m3 = data.retention_m3
            cohort.retention_m4 = data.retention_m4
            cohort.retention_m5 = data.retention_m5
            cohort.retention_m6 = data.retention_m6
            cohort.retention_m7 = data.retention_m7
            cohort.retention_m8 = data.retention_m8
            cohort.retention_m9 = data.retention_m9
            cohort.retention_m10 = data.retention_m10
            cohort.retention_m11 = data.retention_m11
            cohort.retention_m12 = data.retention_m12
            cohort.marketing_spend = data.marketing_spend
            cohort.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.db.flush()
        else:
            cohort = Cohort(
                company_id=company_id,
                period=data.period,
                type=data.type,
                size=data.size,
                retention_m1=data.retention_m1,
                retention_m2=data.retention_m2,
                retention_m3=data.retention_m3,
                retention_m4=data.retention_m4,
                retention_m5=data.retention_m5,
                retention_m6=data.retention_m6,
                retention_m7=data.retention_m7,
                retention_m8=data.retention_m8,
                retention_m9=data.retention_m9,
                retention_m10=data.retention_m10,
                retention_m11=data.retention_m11,
                retention_m12=data.retention_m12,
                marketing_spend=data.marketing_spend,
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
