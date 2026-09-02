import html
from uuid import UUID

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.cohort import Cohort
from app.models.company import Company
from app.models.financing import Financing
from app.models.metric import Metric
from app.services.unit_economics_service import UnitEconomicsService


def _money(v) -> str:
    return "—" if v is None else f"{v:,.0f} ₽"


def _pct(v) -> str:
    return "—" if v is None else f"{v * 100:.1f}%"


def _months(v) -> str:
    return "—" if v is None else f"{v:.1f} мес."


class WeeklyReportService:
    """Формирование еженедельного email-отчёта по портфелю компании."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _prefetch(self, company_ids: list[UUID]) -> tuple[dict, dict]:
        """One grouped query per entity for ALL companies (kills the N+1).

        Returns (prefetched_metrics, prefetched_aux) consumable by
        UnitEconomicsService.get_unit_economics:
        - prefetched_metrics: {(company_id, type): [Metric rows, period desc]}
          — latest 2 of each type per company (window fn over company_id+type,
          joined back to Metric).
        - prefetched_aux: {company_id: {"cohort", "budget", "cash_total"}} —
          latest fact cohort, latest budget (fact preferred), financing total
          (same rounding as common.financing_sums).
        """
        ids = list(company_ids)
        empty: dict = {}
        if not ids:
            return empty, empty

        # Метрики: топ-2 по (company_id, type) по убыванию периода.
        metric_rank = (
            func.row_number()
            .over(
                partition_by=(Metric.company_id, Metric.type),
                order_by=Metric.period.desc(),
            )
            .label("rn")
        )
        metric_subq = (
            select(Metric.id, metric_rank)
            .where(Metric.company_id.in_(ids))
            .subquery()
        )
        metric_rows = (
            (
                await self.db.execute(
                    select(Metric)
                    .join(metric_subq, metric_subq.c.id == Metric.id)
                    .where(metric_subq.c.rn <= 2)
                )
            )
            .scalars()
            .all()
        )
        prefetched_metrics: dict = {}
        for m in metric_rows:
            prefetched_metrics.setdefault((m.company_id, m.type), []).append(m)
        for rows in prefetched_metrics.values():
            rows.sort(key=lambda m: m.period, reverse=True)

        # Когорты: последняя факт-когорта каждой компании.
        cohort_rank = (
            func.row_number()
            .over(
                partition_by=(Cohort.company_id,),
                order_by=Cohort.period.desc(),
            )
            .label("rn")
        )
        cohort_subq = (
            select(Cohort.id, cohort_rank)
            .where(Cohort.company_id.in_(ids), Cohort.type == "fact")
            .subquery()
        )
        cohort_rows = (
            (
                await self.db.execute(
                    select(Cohort)
                    .join(cohort_subq, cohort_subq.c.id == Cohort.id)
                    .where(cohort_subq.c.rn <= 1)
                )
            )
            .scalars()
            .all()
        )
        cohorts_by_company = {c.company_id: c for c in cohort_rows}

        # Бюджеты: последний бюджет компании, факт предпочтительнее плана.
        budget_rank = (
            func.row_number()
            .over(
                partition_by=(Budget.company_id,),
                order_by=(case((Budget.type == "fact", 0), else_=1), Budget.period.desc()),
            )
            .label("rn")
        )
        budget_subq = (
            select(Budget.id, budget_rank)
            .where(Budget.company_id.in_(ids))
            .subquery()
        )
        budget_rows = (
            (
                await self.db.execute(
                    select(Budget)
                    .join(budget_subq, budget_subq.c.id == Budget.id)
                    .where(budget_subq.c.rn <= 1)
                )
            )
            .scalars()
            .all()
        )
        budgets_by_company = {b.company_id: b for b in budget_rows}

        # Финансирование: суммы по компаниям (кредит/инвестиции), как financing_sums.
        fin_rows = (
            await self.db.execute(
                select(Financing.company_id, Financing.type, func.sum(Financing.amount))
                .where(Financing.company_id.in_(ids))
                .group_by(Financing.company_id, Financing.type)
            )
        ).all()
        debt: dict = {}
        cash: dict = {}
        for cid, type_, total in fin_rows:
            if total is None:
                continue
            if type_ == "credit":
                debt[cid] = debt.get(cid, 0.0) + float(total)
            else:
                cash[cid] = cash.get(cid, 0.0) + float(total)

        prefetched_aux: dict = {}
        for cid in ids:
            prefetched_aux[cid] = {
                "cohort": cohorts_by_company.get(cid),
                "budget": budgets_by_company.get(cid),
                "cash_total": round(
                    round(debt.get(cid, 0.0), 2) + round(cash.get(cid, 0.0), 2), 2
                ),
            }

        return prefetched_metrics, prefetched_aux

    async def build_report_html(self, organization_id: UUID) -> str:
        """HTML-отчёт: ключевые метрики и алерты по каждой компании организации."""
        result = await self.db.execute(
            select(Company)
            .where(Company.organization_id == organization_id)
            .order_by(Company.name)
        )
        companies = list(result.scalars().all())

        prefetched_metrics, prefetched_aux = await self._prefetch(
            [company.id for company in companies]
        )

        sections = []
        for company in companies:
            unit = await UnitEconomicsService(self.db).get_unit_economics(
                company.id,
                prefetched_metrics=prefetched_metrics,
                prefetched_aux=prefetched_aux,
            )
            alerts = "".join(f"<li>{html.escape(a)}</li>" for a in unit.alerts)
            sections.append(
                f"<h3>{html.escape(company.name)}</h3>"
                "<ul>"
                f"<li>MRR: {_money(unit.revenue)}</li>"
                f"<li>CAC: {_money(unit.cac)}</li>"
                f"<li>LTV: {_money(unit.ltv)}</li>"
                f"<li>Churn: {_pct(unit.churn)}</li>"
                f"<li>Runway: {_months(unit.runway_months)}</li>"
                "</ul>"
                f"<ul>{alerts}</ul>"
            )

        body = "".join(sections) or "<p>В портфеле пока нет компаний.</p>"

        return (
            "<html><body>"
            "<h2>Еженедельный отчёт по портфелю</h2>"
            f"{body}"
            "</body></html>"
        )
