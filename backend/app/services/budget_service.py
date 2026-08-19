from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.schemas.budget import BudgetUpsert


class BudgetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def upsert_budget(self, company_id: UUID, data: BudgetUpsert) -> Budget:
        result = await self.db.execute(
            select(Budget).where(
                Budget.company_id == company_id,
                Budget.period == data.period,
                Budget.type == data.type,
            )
        )
        budget = result.scalar_one_or_none()

        if budget:
            budget.marketing = data.marketing
            budget.development = data.development
            budget.fot = data.fot
            budget.gna = data.gna
            budget.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await self.db.flush()
        else:
            budget = Budget(
                company_id=company_id,
                period=data.period,
                type=data.type,
                marketing=data.marketing,
                development=data.development,
                fot=data.fot,
                gna=data.gna,
            )
            self.db.add(budget)
            await self.db.flush()

        return budget

    async def list_budgets(
        self, company_id: UUID, period: Optional[date] = None
    ) -> list[Budget]:
        query = select(Budget).where(Budget.company_id == company_id)
        if period is not None:
            query = query.where(Budget.period == period)
        query = query.order_by(Budget.period.desc(), Budget.type)

        result = await self.db.execute(query)
        return list(result.scalars().all())
