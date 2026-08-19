from typing import List, Optional, Type
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metric import Metric
from app.models.cohort import Cohort
from app.models.budget import Budget
from app.models.financing import Financing
from app.schemas.unit_economics import UnitEconomicsResponse, RetentionBreakdown


class UnitEconomicsService:
    """Расчёт юнит-экономики компании (Runway, Retention, LTV/CAC, Magic Number)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_unit_economics(self, company_id: UUID) -> UnitEconomicsResponse:
        # Факт-метрики: последняя и предыдущая (для ΔMRR)
        fact_metrics = await self._latest_metrics(company_id, "fact", limit=2)
        latest_metric = fact_metrics[0] if fact_metrics else None
        previous_metric = fact_metrics[1] if len(fact_metrics) > 1 else None

        latest_cohort = await self._latest(Cohort, company_id, "fact")
        latest_budget = await self._latest(Budget, company_id, "fact")
        cash = await self._financing_total(company_id)

        mrr = self._f(latest_metric.mrr) if latest_metric else None
        cac = self._f(latest_metric.cac) if latest_metric else None
        ltv = self._f(latest_metric.ltv) if latest_metric else None
        churn = float(latest_metric.churn) if latest_metric else None

        # LTV / CAC
        ltv_cac = self._div(ltv, cac)

        # Retention из последней факт-когорты
        retention = RetentionBreakdown(
            m1=self._f(latest_cohort.retention_m1) if latest_cohort else None,
            m3=self._f(latest_cohort.retention_m3) if latest_cohort else None,
            m6=self._f(latest_cohort.retention_m6) if latest_cohort else None,
            m12=self._f(latest_cohort.retention_m12) if latest_cohort else None,
        )

        # Runway = деньги / ежемесячный расход
        monthly_burn = self._monthly_burn(latest_budget)
        runway = self._div(cash, monthly_burn, round_to=1)

        # Magic Number = ΔMRR / затраты на маркетинг
        prev_mrr = self._f(previous_metric.mrr) if previous_metric else None
        revenue_growth = (mrr - prev_mrr) if (mrr is not None and prev_mrr is not None) else None
        marketing_spend = self._f(latest_budget.marketing) if latest_budget else None
        magic_number = self._div(revenue_growth, marketing_spend)

        alerts = self._build_alerts(ltv_cac, churn, runway, magic_number)

        return UnitEconomicsResponse(
            company_id=company_id,
            mrr=mrr,
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
            retention=retention,
            alerts=alerts,
        )

    async def _latest_metrics(
        self, company_id: UUID, type_: str, limit: int
    ) -> List[Metric]:
        result = await self.db.execute(
            select(Metric)
            .where(Metric.company_id == company_id, Metric.type == type_)
            .order_by(Metric.period.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def _latest(self, model: Type, company_id: UUID, type_: str):
        result = await self.db.execute(
            select(model)
            .where(model.company_id == company_id, model.type == type_)
            .order_by(model.period.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _financing_total(self, company_id: UUID) -> Optional[float]:
        result = await self.db.execute(
            select(func.sum(Financing.amount)).where(
                Financing.company_id == company_id
            )
        )
        total = result.scalar_one_or_none()
        return float(total) if total is not None else None

    @staticmethod
    def _monthly_burn(budget: Optional[Budget]) -> Optional[float]:
        if budget is None:
            return None
        return (
            float(budget.marketing)
            + float(budget.development)
            + float(budget.fot)
            + float(budget.gna)
        )

    @staticmethod
    def _f(value) -> Optional[float]:
        return float(value) if value is not None else None

    @staticmethod
    def _div(
        numerator: Optional[float],
        denominator: Optional[float],
        round_to: int = 2,
    ) -> Optional[float]:
        """Деление с защитой от деления на ноль; None, если аргументов нет."""
        if numerator is None or denominator is None or denominator == 0:
            return None
        return round(numerator / denominator, round_to)

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
                alerts.append(f"⚠️ LTV/CAC = {ltv_cac:.2f} (норма > 3). Клиенты не окупаются.")
            else:
                alerts.append(f"✅ LTV/CAC = {ltv_cac:.2f} — отличный показатель.")

        if churn is not None:
            if churn > 0.05:
                alerts.append(f"⚠️ Churn = {churn * 100:.1f}% (норма < 5%). Высокий отток.")
            else:
                alerts.append(f"✅ Churn = {churn * 100:.1f}% — в норме.")

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
                alerts.append(f"✅ Magic Number = {magic_number:.2f} — эффективные продажи.")

        return alerts
