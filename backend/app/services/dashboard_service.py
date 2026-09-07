from collections import defaultdict
from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import health as health_rules
from app.models.budget import Budget
from app.models.company import Company
from app.models.financing import Financing
from app.models.metric import Metric
from app.models.task import Task
from app.schemas.dashboard import (
    AttentionSignal,
    CompanyStatusItem,
    DashboardResponse,
    PerformancePoint,
)


def _mean(values: list[float]) -> Optional[float]:
    """Среднее арифметическое; None, если значений нет."""
    if not values:
        return None
    return sum(values) / len(values)


def _growth(latest: Optional[float], prev: Optional[float]) -> Optional[float]:
    """Относительный MoM-рост (доля); None, если не вычислим."""
    if latest is None or prev is None or prev == 0:
        return None
    return round((latest - prev) / prev, 4)


class DashboardService:
    """Сервис агрегированных метрик портфеля компаний (без N+1)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, organization_id: UUID) -> DashboardResponse:
        """Агрегированные показатели по активным компаниям организации."""
        result = await self.db.execute(
            select(Company)
            .where(
                Company.organization_id == organization_id,
                Company.archived_at.is_(None),
            )
            .order_by(Company.name)
        )
        companies = list(result.scalars().all())
        company_ids = [c.id for c in companies]

        # 1 batched query per table — no per-company N+1.
        metrics_by_company: dict[UUID, list[Metric]] = defaultdict(list)
        budgets_by_company: dict[UUID, list[Budget]] = defaultdict(list)
        cash_by_company: dict[UUID, float] = {}
        progress: dict[UUID, Optional[int]] = {}

        if company_ids:
            metrics_rows = await self.db.execute(
                select(Metric)
                .where(Metric.company_id.in_(company_ids))
                .order_by(Metric.period.asc())
            )
            for m in metrics_rows.scalars().all():
                metrics_by_company[m.company_id].append(m)

            budget_rows = await self.db.execute(
                select(Budget)
                .where(Budget.company_id.in_(company_ids))
                .order_by(Budget.period.asc())
            )
            for b in budget_rows.scalars().all():
                budgets_by_company[b.company_id].append(b)

            fin_rows = await self.db.execute(
                select(Financing.company_id, func.sum(Financing.amount))
                .where(Financing.company_id.in_(company_ids))
                .group_by(Financing.company_id)
            )
            for cid, total in fin_rows.all():
                if total is not None:
                    cash_by_company[cid] = round(float(total), 2)

            progress_rows = await self.db.execute(
                select(
                    Task.company_id,
                    func.count().label("total"),
                    func.count().filter(Task.status == "done").label("done"),
                )
                .where(Task.company_id.in_(company_ids))
                .group_by(Task.company_id)
            )
            progress = {
                row.company_id: None if row.total == 0 else round(row.done / row.total * 100)
                for row in progress_rows.all()
            }

        items: list[CompanyStatusItem] = []
        counts = {"on_track": 0, "behind": 0, "no_plan": 0, "no_data": 0}
        at_risk = 0

        revenue_values: list[float] = []
        cac_values: list[float] = []
        ltv_values: list[float] = []
        churn_values: list[float] = []
        prev_revenue_values: list[float] = []
        runway_values: list[float] = []

        for company in companies:
            cid = company.id
            rows = metrics_by_company.get(cid, [])
            facts = sorted((m for m in rows if m.type == "fact"), key=lambda m: m.period)
            plans = sorted((m for m in rows if m.type == "plan"), key=lambda m: m.period)
            fact = facts[-1] if facts else None
            prev_fact = facts[-2] if len(facts) >= 2 else None
            plan = plans[-1] if plans else None

            budget, prev_budget = self._latest_two_budgets(budgets_by_company.get(cid, []))
            burn = self._burn(budget)
            prev_burn = self._burn(prev_budget)
            cash = cash_by_company.get(cid, 0.0)
            cash = cash if cash != 0.0 else None

            if fact is None:
                status = "no_data"
                latest_revenue = None
                latest_plan_revenue = None
                revenue_growth = None
                health = health_rules.STATUS_NO_DATA
                attention: list[AttentionSignal] = [
                    AttentionSignal(kind="no_data", label="Нет данных", severity="info")
                ]
            else:
                latest_revenue = float(fact.revenue)
                revenue_values.append(latest_revenue)
                cac_values.append(float(fact.cac))
                ltv_values.append(float(fact.ltv))
                churn_values.append(float(fact.churn))

                prev_revenue = float(prev_fact.revenue) if prev_fact else None
                revenue_growth = _growth(latest_revenue, prev_revenue)
                if prev_revenue is not None:
                    prev_revenue_values.append(prev_revenue)

                if plan is None:
                    status = "no_plan"
                    latest_plan_revenue = None
                else:
                    latest_plan_revenue = float(plan.revenue)
                    status = "on_track" if latest_revenue >= latest_plan_revenue else "behind"

                health, _signals, attention_raw = health_rules.evaluate_health(
                    revenue=latest_revenue,
                    prev_revenue=prev_revenue,
                    retention=float(fact.retention_rate),
                    prev_retention=float(prev_fact.retention_rate) if prev_fact else None,
                    cac=float(fact.cac),
                    prev_cac=float(prev_fact.cac) if prev_fact else None,
                    churn=float(fact.churn),
                    plan_revenue=latest_plan_revenue,
                    burn=burn,
                    prev_burn=prev_burn,
                    cash=cash,
                )
                attention = [AttentionSignal(**a) for a in attention_raw]
                if health in (health_rules.STATUS_ATTENTION, health_rules.STATUS_CRITICAL):
                    at_risk += 1

            runway = health_rules.runway_months(cash, burn)
            if runway is not None:
                runway_values.append(runway)

            last_update = fact.period if fact else (plan.period if plan else None)

            counts[status] += 1

            items.append(
                CompanyStatusItem(
                    id=company.id,
                    name=company.name,
                    industry=company.industry,
                    geography=company.geography,
                    business_model=company.business_model,
                    status=status,
                    latest_revenue=latest_revenue,
                    latest_plan_revenue=latest_plan_revenue,
                    revenue_growth=revenue_growth,
                    runway_months=runway,
                    last_update=last_update,
                    health=health,
                    attention=attention,
                    task_progress=progress.get(cid),
                )
            )

        return DashboardResponse(
            total_companies=len(companies),
            avg_revenue=_mean(revenue_values),
            avg_cac=_mean(cac_values),
            avg_ltv=_mean(ltv_values),
            avg_churn=_mean(churn_values),
            portfolio_revenue=round(sum(revenue_values), 2) if revenue_values else None,
            revenue_growth=_growth(
                sum(revenue_values) if revenue_values else None,
                sum(prev_revenue_values) if prev_revenue_values else None,
            ),
            companies_at_risk=at_risk,
            avg_runway=_mean(runway_values),
            companies_without_data=counts["no_data"],
            on_track=counts["on_track"],
            behind=counts["behind"],
            no_plan=counts["no_plan"],
            no_data=counts["no_data"],
            companies=items,
        )

    async def get_performance(
        self, organization_id: UUID, months: int = 6
    ) -> list[PerformancePoint]:
        """Агрегированная выручка портфеля (fact/plan) по последним N месяцам."""
        months = max(1, min(months, 24))
        result = await self.db.execute(
            select(Company.id).where(
                Company.organization_id == organization_id,
                Company.archived_at.is_(None),
            )
        )
        company_ids = [cid for cid in result.scalars().all()]
        if not company_ids:
            return []

        metrics_rows = await self.db.execute(
            select(Metric.period, Metric.type, Metric.revenue)
            .where(Metric.company_id.in_(company_ids))
            .order_by(Metric.period.asc())
        )
        fact_by_period: dict[str, float] = defaultdict(float)
        plan_by_period: dict[str, float] = defaultdict(float)
        for period, type_, revenue in metrics_rows.all():
            key = period.strftime("%Y-%m")
            if type_ == "fact":
                fact_by_period[key] += float(revenue)
            else:
                plan_by_period[key] += float(revenue)

        periods = sorted(set(fact_by_period) | set(plan_by_period))
        last = periods[-months:]
        return [
            PerformancePoint(
                month=p,
                fact=round(fact_by_period[p], 2) if p in fact_by_period else None,
                plan=round(plan_by_period[p], 2) if p in plan_by_period else None,
            )
            for p in last
        ]

    @staticmethod
    def _latest_two_budgets(brows: list[Budget]) -> tuple[Optional[Budget], Optional[Budget]]:
        bfact = sorted((b for b in brows if b.type == "fact"), key=lambda b: b.period)
        bplan = sorted((b for b in brows if b.type == "plan"), key=lambda b: b.period)
        seq = bfact if bfact else bplan
        latest = seq[-1] if seq else None
        prev = seq[-2] if len(seq) >= 2 else None
        return latest, prev

    @staticmethod
    def _burn(budget: Optional[Budget]) -> Optional[float]:
        if budget is None:
            return None
        return (
            float(budget.marketing)
            + float(budget.development)
            + float(budget.fot)
            + float(budget.gna)
        )
