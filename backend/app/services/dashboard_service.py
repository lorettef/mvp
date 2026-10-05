from collections import defaultdict
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import health as health_rules
from app.models.budget import Budget
from app.models.company import Company
from app.models.financing import Financing
from app.models.hiring_settings import HiringSettings
from app.models.metric import Metric
from app.models.task import Task
from app.schemas.dashboard import (
    AttentionSignal,
    CompanyStatusItem,
    DashboardFilters,
    DashboardMetricSnapshot,
    DashboardResponse,
    IndustryProfitabilityItem,
    PerformancePoint,
)
from app.schemas.hiring import DEFAULT_EMPLOYER_RATE
from app.services.operating_profit import employer_social_rate, operating_profit


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


@dataclass
class _CompanySnapshot:
    item: CompanyStatusItem
    previous_revenue: Optional[float]
    metrics: list[Metric]
    fact_budget: Optional[Budget]


class DashboardService:
    """Сервис агрегированных метрик портфеля компаний (без N+1)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _resolve_portfolio(
        self,
        organization_id: UUID,
        filters: DashboardFilters,
        *,
        include_progress: bool = False
    ) -> list[_CompanySnapshot]:
        """Scope → batched as-of data → snapshots → derived filters.

        Both endpoints consume this universe. Never apply the lower date bound
        to the loader: earlier Fact and accumulated cash are needed by snapshots.
        """
        scope = select(Company).where(
            Company.organization_id == organization_id,
            Company.archived_at.is_(None),
        )
        if filters.company_ids:
            scope = scope.where(Company.id.in_(filters.company_ids))
        if filters.industries:
            scope = scope.where(Company.industry.in_(filters.industries))
        result = await self.db.execute(scope.order_by(Company.name))
        companies = list(result.scalars().all())
        company_ids = [c.id for c in companies]

        # 1 batched query per table — no per-company N+1.
        metrics_by_company: dict[UUID, list[Metric]] = defaultdict(list)
        budgets_by_company: dict[UUID, list[Budget]] = defaultdict(list)
        cash_by_company: dict[UUID, float] = {}
        progress: dict[UUID, Optional[int]] = {}

        if company_ids:
            metric_query = select(Metric).where(Metric.company_id.in_(company_ids))
            budget_query = select(Budget).where(Budget.company_id.in_(company_ids))
            financing_query = select(
                Financing.company_id, func.sum(Financing.amount)
            ).where(Financing.company_id.in_(company_ids))
            if filters.period_to is not None:
                metric_query = metric_query.where(Metric.period <= filters.period_to)
                budget_query = budget_query.where(Budget.period <= filters.period_to)
                # Undated legacy financing is opening funding (CashFlow convention).
                financing_query = financing_query.where(
                    or_(
                        Financing.issued_date.is_(None),
                        Financing.issued_date <= filters.period_to,
                    )
                )
            metrics_rows = await self.db.execute(
                metric_query.order_by(Metric.period.asc())
            )
            for m in metrics_rows.scalars().all():
                metrics_by_company[m.company_id].append(m)

            budget_rows = await self.db.execute(
                budget_query.order_by(Budget.period.asc())
            )
            for b in budget_rows.scalars().all():
                budgets_by_company[b.company_id].append(b)

            fin_rows = await self.db.execute(
                financing_query.group_by(Financing.company_id)
            )
            for cid, total in fin_rows.all():
                if total is not None:
                    cash_by_company[cid] = round(float(total), 2)

            if include_progress:
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
                    row.company_id: (
                        None if row.total == 0 else round(row.done / row.total * 100)
                    )
                    for row in progress_rows.all()
                }

        snapshots: list[_CompanySnapshot] = []

        for company in companies:
            cid = company.id
            rows = metrics_by_company.get(cid, [])
            facts = sorted(
                (m for m in rows if m.type == "fact"), key=lambda m: m.period
            )
            plans = sorted(
                (m for m in rows if m.type == "plan"), key=lambda m: m.period
            )
            candidates = [
                m
                for m in facts
                if filters.period_from is None or m.period >= filters.period_from
            ]
            fact = candidates[-1] if candidates else None
            prev_fact = (
                next((m for m in reversed(facts) if m.period < fact.period), None)
                if fact
                else None
            )
            prev_revenue = float(prev_fact.revenue) if prev_fact else None
            # PF-1: план сравнивается с ФАКТОМ за ТОТ ЖЕ период (не «последний план»).
            plan = (
                next((p for p in reversed(plans) if p.period == fact.period), None)
                if fact
                else None
            )

            budget, prev_budget = self._latest_two_budgets(
                budgets_by_company.get(cid, [])
            )
            burn = self._burn(budget)
            prev_burn = self._burn(prev_budget)
            # Cash для runway = финансирование + накопленная операционная прибыль
            # (та же экономика, что и closing balance в Cash Flow, но batched).
            financing = cash_by_company.get(cid, 0.0)
            profit = self._accumulated_profit(
                metrics_by_company.get(cid, []), budgets_by_company.get(cid, [])
            )
            cash = financing + profit
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
                revenue_growth = _growth(latest_revenue, prev_revenue)

                if plan is None:
                    status = "no_plan"
                    latest_plan_revenue = None
                else:
                    latest_plan_revenue = float(plan.revenue)
                    status = (
                        "on_track"
                        if latest_revenue >= latest_plan_revenue
                        else "behind"
                    )

                health, _signals, attention_raw = health_rules.evaluate_health(
                    revenue=latest_revenue,
                    prev_revenue=prev_revenue,
                    retention=float(fact.retention_rate),
                    prev_retention=(
                        float(prev_fact.retention_rate) if prev_fact else None
                    ),
                    cac=float(fact.cac),
                    prev_cac=float(prev_fact.cac) if prev_fact else None,
                    churn=float(fact.churn),
                    plan_revenue=latest_plan_revenue,
                    burn=burn,
                    prev_burn=prev_burn,
                    cash=cash,
                )
                attention = [AttentionSignal(**a) for a in attention_raw]

            runway = health_rules.runway_months(cash, burn)

            last_update = fact.period if fact else (plan.period if plan else None)

            item = CompanyStatusItem(
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
                fact=DashboardMetricSnapshot.model_validate(fact) if fact else None,
                plan=DashboardMetricSnapshot.model_validate(plan) if plan else None,
            )
            if filters.health and item.health not in filters.health:
                continue
            if (
                filters.performance_status
                and item.status not in filters.performance_status
            ):
                continue
            fact_budget = next(
                (
                    b
                    for b in budgets_by_company.get(cid, [])
                    if fact is not None and b.type == "fact" and b.period == fact.period
                ),
                None,
            )
            snapshots.append(_CompanySnapshot(item, prev_revenue, rows, fact_budget))
        return snapshots

    async def _industry_profitability(
        self, snapshots: list[_CompanySnapshot]
    ) -> list[IndustryProfitabilityItem]:
        eligible_ids = [
            s.item.id for s in snapshots if s.item.fact is not None and s.fact_budget
        ]
        settings_by_company = {}
        if eligible_ids:
            rows = await self.db.execute(
                select(HiringSettings).where(
                    HiringSettings.company_id.in_(eligible_ids)
                )
            )
            settings_by_company = {row.company_id: row for row in rows.scalars().all()}

        groups: dict[Optional[str], IndustryProfitabilityItem] = {}
        for snapshot in snapshots:
            item = snapshot.item
            group = groups.setdefault(
                item.industry,
                IndustryProfitabilityItem(
                    industry=item.industry,
                    revenue=0,
                    total_opex=0,
                    ebitda=0,
                    ebitda_margin=None,
                    companies_total=0,
                    companies_included=0,
                ),
            )
            group.companies_total += 1
            fact, budget = item.fact, snapshot.fact_budget
            if fact is None or budget is None:
                continue
            # HiringSettings is current, not historically versioned. Date filters
            # select Fact/Fact-budget months, not an invented settings history.
            settings = settings_by_company.get(item.id)
            rate = (
                employer_social_rate(
                    float(settings.insurance_rate), float(settings.injury_rate)
                )
                if settings
                else employer_social_rate()
            )
            operating = operating_profit(
                fact.revenue,
                fot=float(budget.fot),
                marketing=float(budget.marketing),
                development=float(budget.development),
                gna=float(budget.gna),
                employer_rate=rate,
            )
            if operating.total_opex is None or operating.ebitda is None:
                continue
            group.companies_included += 1
            group.revenue += fact.revenue
            group.total_opex += operating.total_opex
            group.ebitda += operating.ebitda

        # Stable slug order; null is a separate group, never the catalog's "other".
        result = sorted(
            groups.values(), key=lambda g: (g.industry is None, g.industry or "")
        )
        for group in result:
            group.revenue = round(group.revenue, 2)
            group.total_opex = round(group.total_opex, 2)
            group.ebitda = round(group.ebitda, 2)
            group.ebitda_margin = (
                round(group.ebitda / group.revenue, 4) if group.revenue != 0 else None
            )
        return result

    async def get_dashboard(
        self, organization_id: UUID, filters: Optional[DashboardFilters] = None
    ) -> DashboardResponse:
        snapshots = await self._resolve_portfolio(
            organization_id, filters or DashboardFilters(), include_progress=True
        )
        items = [snapshot.item for snapshot in snapshots]
        facts = [item.fact for item in items if item.fact is not None]
        revenue_values = [fact.revenue for fact in facts]
        prev_revenue_values = [
            snapshot.previous_revenue
            for snapshot in snapshots
            if snapshot.previous_revenue is not None
        ]
        counts = {
            status: sum(item.status == status for item in items)
            for status in ("on_track", "behind", "no_plan", "no_data")
        }
        return DashboardResponse(
            total_companies=len(items),
            avg_revenue=_mean(revenue_values),
            avg_cac=_mean([fact.cac for fact in facts]),
            avg_ltv=_mean([fact.ltv for fact in facts]),
            avg_churn=_mean([fact.churn for fact in facts]),
            portfolio_revenue=round(sum(revenue_values), 2) if revenue_values else None,
            revenue_growth=_growth(
                sum(revenue_values) if revenue_values else None,
                sum(prev_revenue_values) if prev_revenue_values else None,
            ),
            companies_at_risk=sum(
                item.health
                in (health_rules.STATUS_ATTENTION, health_rules.STATUS_CRITICAL)
                for item in items
            ),
            avg_runway=_mean(
                [item.runway_months for item in items if item.runway_months is not None]
            ),
            companies_without_data=counts["no_data"],
            on_track=counts["on_track"],
            behind=counts["behind"],
            no_plan=counts["no_plan"],
            no_data=counts["no_data"],
            companies=items,
            profitability_by_industry=await self._industry_profitability(snapshots),
        )

    async def get_performance(
        self,
        organization_id: UUID,
        months: Optional[int] = None,
        filters: Optional[DashboardFilters] = None,
    ) -> list[PerformancePoint]:
        """Same snapshot universe as KPI; series dates then optional last-N cap.

        No dates/no months preserves the legacy last-six available periods.
        Explicit dates without months return every available period in range.
        """
        filters = filters or DashboardFilters()
        limit = months
        if limit is None and filters.period_from is None and filters.period_to is None:
            limit = 6
        if limit is not None:
            limit = max(1, min(limit, 24))
        snapshots = await self._resolve_portfolio(organization_id, filters)
        fact_by_period: dict[str, float] = defaultdict(float)
        plan_by_period: dict[str, float] = defaultdict(float)
        for snapshot in snapshots:
            for metric in snapshot.metrics:
                if (
                    filters.period_from is not None
                    and metric.period < filters.period_from
                ):
                    continue
                key = metric.period.strftime("%Y-%m")
                series = fact_by_period if metric.type == "fact" else plan_by_period
                series[key] += float(metric.revenue)

        periods = sorted(set(fact_by_period) | set(plan_by_period))
        last = periods[-limit:] if limit is not None else periods
        return [
            PerformancePoint(
                month=p,
                fact=round(fact_by_period[p], 2) if p in fact_by_period else None,
                plan=round(plan_by_period[p], 2) if p in plan_by_period else None,
            )
            for p in last
        ]

    @staticmethod
    def _latest_two_budgets(
        brows: list[Budget],
    ) -> tuple[Optional[Budget], Optional[Budget]]:
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
        fot = float(budget.fot)
        social = fot * DEFAULT_EMPLOYER_RATE  # соц. платежи работодателя (как в P&L)
        return (
            float(budget.marketing)
            + float(budget.development)
            + fot
            + float(budget.gna)
            + social
        )

    @staticmethod
    def _accumulated_profit(metrics: list[Metric], budgets: list[Budget]) -> float:
        """Накопленная операционная прибыль (выручка − OPEX) по факт-периодам."""
        revenue = sum(
            float(m.revenue)
            for m in metrics
            if m.type == "fact" and m.revenue is not None
        )
        if revenue == 0.0:
            revenue = sum(
                float(m.revenue)
                for m in metrics
                if m.type == "plan" and m.revenue is not None
            )
        opex = 0.0
        for b in budgets:
            if b.type != "fact":
                continue
            fot = float(b.fot)
            opex += (
                float(b.marketing)
                + float(b.development)
                + fot
                + float(b.gna)
                + fot * DEFAULT_EMPLOYER_RATE
            )
        return round(revenue - opex, 2)
