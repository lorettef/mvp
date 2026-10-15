from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cohort import Cohort
from app.models.budget import Budget
from app.schemas.hiring import DEFAULT_EMPLOYER_RATE
from app.schemas.unit_economics import (
    UnitEconomicsMetricSource,
    UnitEconomicsResponse,
    RetentionBreakdown,
)
from app.services.gross_profit import gross_profit
from app.services.common import (
    div,
    f,
    financing_sums,
    latest_budget,
    latest_metrics,
)


class UnitEconomicsService:
    """Расчёт юнит-экономики компании (Runway, Retention, LTV/CAC, Magic Number)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_unit_economics(
        self,
        company_id: UUID,
        prefetched_metrics: Optional[dict] = None,
        prefetched_aux: Optional[dict] = None,
    ) -> UnitEconomicsResponse:
        """Расчёт юнит-экономики компании.

        Optional prefetch (used by batch callers, e.g. WeeklyReportService):
        - prefetched_metrics: dict {(company_id, type): [Metric rows ordered
          period desc]}. When provided, fact_metrics are derived from it
          (latest 2 of "fact", falling back to "plan" if no fact rows) instead
          of querying via latest_metrics.
        - prefetched_aux: dict {company_id: {"cohort": Cohort|None,
          "budget": Budget|None, "cash_total": float}}. When provided, the
          latest cohort / budget / financing total are read from it instead of
          querying.
        When either is None, the exact legacy per-company query behavior is kept.
        """
        if prefetched_metrics is not None:
            fact_metrics = list(prefetched_metrics.get((company_id, "fact"), ()))[:2]
            if not fact_metrics:
                fact_metrics = list(prefetched_metrics.get((company_id, "plan"), ()))[
                    :2
                ]
        else:
            # Факт-метрики: последняя и предыдущая (для ΔMRR); fallback на план (D1)
            fact_metrics = await latest_metrics(
                self.db, company_id, prefer="fact", fallback=True, limit=2
            )
        latest_metric = fact_metrics[0] if fact_metrics else None
        previous_metric = fact_metrics[1] if len(fact_metrics) > 1 else None

        if prefetched_aux is not None:
            aux = prefetched_aux.get(company_id) or {}
            latest_cohort = aux.get("cohort")
            budget = aux.get("budget")
            cash_total = aux.get("cash_total", 0.0)
        else:
            latest_cohort = await self._latest_cohort(company_id)
            budget = await latest_budget(self.db, company_id, limit=1)
            cash_total = (await financing_sums(self.db, company_id)).total
        cash = cash_total if cash_total != 0.0 else None
        # Runway/marketing retain their established latest-budget semantics.
        # Gross Margin alone requires exact Metric + Budget identity.
        source_budget = None
        if latest_metric is not None:
            if (
                budget is not None
                and budget.company_id == company_id
                and budget.period == latest_metric.period
                and budget.type == latest_metric.type
            ):
                source_budget = budget
            else:
                source_budget = (
                    await self.db.execute(
                        select(Budget).where(
                            Budget.company_id == company_id,
                            Budget.period == latest_metric.period,
                            Budget.type == latest_metric.type,
                        )
                    )
                ).scalar_one_or_none()

        revenue = f(latest_metric.revenue, None) if latest_metric else None
        arpu = f(latest_metric.arpu, None) if latest_metric else None
        cac = f(latest_metric.cac, None) if latest_metric else None
        ltv = f(latest_metric.ltv, None) if latest_metric else None
        churn = float(latest_metric.churn) if latest_metric else None
        cogs = f(source_budget.cogs, None) if source_budget else None
        gross_margin = gross_profit(revenue, cogs).gross_margin

        # LTV / CAC
        ltv_cac = div(ltv, cac, None, round_to=2)

        # Retention из последней факт-когорты
        retention = RetentionBreakdown(
            m1=f(latest_cohort.retention_m1, None) if latest_cohort else None,
            m3=f(latest_cohort.retention_m3, None) if latest_cohort else None,
            m6=f(latest_cohort.retention_m6, None) if latest_cohort else None,
            m12=f(latest_cohort.retention_m12, None) if latest_cohort else None,
        )

        # Runway = деньги / ежемесячный расход
        monthly_burn = self._monthly_burn(budget)
        runway = div(cash, monthly_burn, None, round_to=1)

        # Magic Number = ΔRevenue / затраты на маркетинг
        prev_revenue = f(previous_metric.revenue, None) if previous_metric else None
        revenue_growth = (
            (revenue - prev_revenue)
            if (revenue is not None and prev_revenue is not None)
            else None
        )
        marketing_spend = f(budget.marketing, None) if budget else None
        magic_number = div(revenue_growth, marketing_spend, None)

        # Payback = CAC / (ARPU × gross_margin); ROMI = (LTV − CAC) / CAC
        payback_period = (
            round(cac / (arpu * gross_margin), 2)
            if cac is not None
            and cac >= 0
            and arpu is not None
            and arpu > 0
            and gross_margin is not None
            and gross_margin > 0
            else None
        )
        romi = round((ltv - cac) / cac, 4) if cac else None

        alerts = self._build_alerts(ltv_cac, churn, runway, magic_number)

        return UnitEconomicsResponse(
            company_id=company_id,
            source_metric=(
                UnitEconomicsMetricSource.model_validate(latest_metric)
                if latest_metric is not None
                else None
            ),
            revenue=revenue,
            cac=cac,
            ltv=ltv,
            churn=churn,
            ltv_cac=ltv_cac,
            runway_months=runway,
            cash=cash,
            monthly_burn=monthly_burn,
            magic_number=magic_number,
            revenue_growth=revenue_growth,
            marketing_spend=marketing_spend,
            gross_margin=gross_margin,
            payback_period=payback_period,
            romi=romi,
            retention=retention,
            alerts=alerts,
        )

    async def _latest_cohort(self, company_id: UUID) -> Optional[Cohort]:
        result = await self.db.execute(
            select(Cohort)
            .where(Cohort.company_id == company_id, Cohort.type == "fact")
            .order_by(Cohort.period.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    @staticmethod
    def _monthly_burn(budget: Optional[Budget]) -> Optional[float]:
        if budget is None:
            return None
        fot = float(budget.fot)
        social = fot * DEFAULT_EMPLOYER_RATE  # соц. платежи работодателя
        return (
            float(budget.marketing)
            + float(budget.development)
            + fot
            + float(budget.gna)
            + social
        )

    @staticmethod
    def _build_alerts(
        ltv_cac: Optional[float],
        churn: Optional[float],
        runway: Optional[float],
        magic_number: Optional[float],
    ) -> List[str]:
        alerts: List[str] = []

        if ltv_cac is not None:
            if ltv_cac < 3:
                alerts.append(
                    f"⚠️ LTV/CAC = {ltv_cac:.2f} (норма > 3). Клиенты не окупаются."
                )
            else:
                alerts.append(f"✅ LTV/CAC = {ltv_cac:.2f} — отличный показатель.")

        if churn is not None:
            if churn > 0.05:
                alerts.append(
                    f"⚠️ Отток клиентов (Churn) = {churn * 100:.1f}% (норма < 5%). Высокий отток."
                )
            else:
                alerts.append(
                    f"✅ Отток клиентов (Churn) = {churn * 100:.1f}% — в норме."
                )

        if runway is not None:
            if runway < 6:
                alerts.append(f"⚠️ Runway = {runway:.1f} мес. (критично < 6).")
            elif runway < 12:
                alerts.append(f"📊 Runway = {runway:.1f} мес. (рекомендуется > 12).")
            else:
                alerts.append(f"✅ Runway = {runway:.1f} мес. — хороший запас.")

        if magic_number is not None:
            if magic_number < 1:
                alerts.append(f"⚠️ Magic Number = {magic_number:.2f} (норма > 1).")
            else:
                alerts.append(
                    f"✅ Magic Number = {magic_number:.2f} — эффективные продажи."
                )

        return alerts
