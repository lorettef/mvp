from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import health as health_rules
from app.models.budget import Budget
from app.schemas.health import BusinessHealthResponse, HealthSignal
from app.services.common import financing_sums, latest_budget, latest_metrics


class HealthService:
    """Детерминированная оценка состояния бизнеса компании.

    Никакого composite score — только объяснимые сигналы (revenue, retention,
    cac, burn, runway) и итоговый статус healthy/attention/critical/no_data,
    вычисляемый в `app.core.health`.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_health(self, company_id: UUID) -> BusinessHealthResponse:
        # Latest 2 fact metrics (fallback to plan if no fact rows) for trends.
        fact_metrics = await latest_metrics(
            self.db, company_id, prefer="fact", fallback=True, limit=2
        )
        latest_fact = fact_metrics[0] if fact_metrics else None
        prev_fact = fact_metrics[1] if len(fact_metrics) > 1 else None

        plan_metrics = await latest_metrics(self.db, company_id, prefer="plan", limit=1)
        latest_plan = plan_metrics[0] if plan_metrics else None

        budgets = await self._latest_budgets(company_id, limit=2)
        budget = budgets[0] if budgets else None
        prev_budget = budgets[1] if len(budgets) > 1 else None

        cash = (await financing_sums(self.db, company_id)).total

        status, signals, _attention = health_rules.evaluate_health(
            revenue=self._f(latest_fact.revenue) if latest_fact else None,
            prev_revenue=self._f(prev_fact.revenue) if prev_fact else None,
            retention=self._f(latest_fact.retention_rate) if latest_fact else None,
            prev_retention=self._f(prev_fact.retention_rate) if prev_fact else None,
            cac=self._f(latest_fact.cac) if latest_fact else None,
            prev_cac=self._f(prev_fact.cac) if prev_fact else None,
            churn=self._f(latest_fact.churn) if latest_fact else None,
            plan_revenue=self._f(latest_plan.revenue) if latest_plan else None,
            burn=self._burn(budget),
            prev_burn=self._burn(prev_budget),
            cash=cash if cash != 0.0 else None,
        )

        return BusinessHealthResponse(
            company_id=company_id,
            status=status,
            signals=[HealthSignal(**s) for s in signals],
            summary=health_rules.summarize(status, signals),
        )

    async def _latest_budgets(self, company_id: UUID, limit: int = 2) -> list[Budget]:
        result = await self.db.execute(
            select(Budget)
            .where(Budget.company_id == company_id, Budget.type == "fact")
            .order_by(Budget.period.desc())
            .limit(limit)
        )
        rows = list(result.scalars().all())
        if not rows:
            result = await self.db.execute(
                select(Budget)
                .where(Budget.company_id == company_id, Budget.type == "plan")
                .order_by(Budget.period.desc())
                .limit(limit)
            )
            rows = list(result.scalars().all())
        return rows

    @staticmethod
    def _f(value) -> float | None:
        return float(value) if value is not None else None

    @staticmethod
    def _burn(budget: Budget | None) -> float | None:
        if budget is None:
            return None
        return (
            float(budget.marketing)
            + float(budget.development)
            + float(budget.fot)
            + float(budget.gna)
        )
