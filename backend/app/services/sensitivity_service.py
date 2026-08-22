from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.metric import Metric
from app.schemas.sensitivity import Scenario, SensitivityResponse
from app.services.market_service import GEOGRAPHIES
from app.services.pnl_service import PnLService
from app.services.valuation_service import ValuationService

SALES_STRESS = 0.9
CAC_STRESS = 1.1
LTV_STRESS = 0.95
CHURN_STRESS = 1.1
DEFAULT_GEOGRAPHY = "RU"


class SensitivityService:
    """Анализ чувствительности: консервативный сценарий vs базовый."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def analyze(self, company_id: UUID) -> SensitivityResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        geography = self._normalize_geography(company.geography)
        key_rate = GEOGRAPHIES[geography]["key_rate"]
        discount_rate = round(key_rate + 10.0, 2)

        valuation = await ValuationService(self.db).get_valuation(company_id)
        pnl = await PnLService(self.db).get_pnl(company_id)
        metric = await self._latest_metric(company_id)

        mrr = pnl.mrr
        marketing = pnl.marketing or 0.0
        development = pnl.development or 0.0
        fot = pnl.fot or 0.0
        gna = pnl.gna or 0.0
        social = pnl.social_payments or 0.0
        financial_expenses = pnl.financial_expenses

        cac = self._f(metric.cac) if metric else None
        ltv = self._f(metric.ltv) if metric else None
        churn = float(metric.churn) if metric and metric.churn is not None else None

        if mrr is None:
            return SensitivityResponse(
                company_id=company_id,
                geography=geography,
                key_rate=key_rate,
                discount_rate=discount_rate,
                base=Scenario(),
                conservative=Scenario(),
                summary="Недостаточно данных: добавьте метрики (MRR).",
            )

        base = Scenario(
            equity_value=valuation.equity_value,
            terminal_value=valuation.terminal_value,
            fcf=valuation.fcf,
            growth_rate=valuation.growth_rate,
            mrr=mrr,
            cac=cac,
            ltv=ltv,
            churn=churn,
            ltv_cac=self._div(ltv, cac),
        )

        stressed_mrr = round(mrr * SALES_STRESS, 2)
        stressed_marketing = round(marketing * CAC_STRESS, 2)
        stressed_opex = round(
            stressed_marketing + development + fot + gna + social, 2
        )
        stressed_net_profit = round(
            stressed_mrr - stressed_opex - financial_expenses, 2
        )

        stressed_cac = round(cac * CAC_STRESS, 2) if cac is not None else None
        stressed_ltv = round(ltv * LTV_STRESS, 2) if ltv is not None else None
        stressed_churn = (
            round(min(churn * CHURN_STRESS, 1.0), 4) if churn is not None else None
        )

        stressed_growth = round(
            valuation.growth_rate
            * LTV_STRESS
            * (1 - (stressed_churn if stressed_churn is not None else 0.0)),
            2,
        )

        stressed_tv, stressed_equity = ValuationService._gordon(
            stressed_net_profit,
            discount_rate,
            stressed_growth,
            valuation.net_debt,
        )

        conservative = Scenario(
            equity_value=stressed_equity,
            terminal_value=stressed_tv,
            fcf=stressed_net_profit,
            growth_rate=stressed_growth,
            mrr=stressed_mrr,
            cac=stressed_cac,
            ltv=stressed_ltv,
            churn=stressed_churn,
            ltv_cac=self._div(stressed_ltv, stressed_cac),
        )

        equity_delta, equity_delta_pct = self._delta(
            base.equity_value, stressed_equity
        )

        return SensitivityResponse(
            company_id=company_id,
            geography=geography,
            key_rate=key_rate,
            discount_rate=discount_rate,
            base=base,
            conservative=conservative,
            equity_delta=equity_delta,
            equity_delta_pct=equity_delta_pct,
            summary=self._summary(base.equity_value, stressed_equity, equity_delta, equity_delta_pct),
        )

    async def _latest_metric(self, company_id: UUID) -> Optional[Metric]:
        for type_ in ("fact", "plan"):
            result = await self.db.execute(
                select(Metric)
                .where(Metric.company_id == company_id, Metric.type == type_)
                .order_by(Metric.period.desc())
                .limit(1)
            )
            metric = result.scalar_one_or_none()
            if metric is not None:
                return metric
        return None

    @staticmethod
    def _normalize_geography(geography: Optional[str]) -> str:
        key = (geography or DEFAULT_GEOGRAPHY).strip().upper()
        return key if key in GEOGRAPHIES else DEFAULT_GEOGRAPHY

    @staticmethod
    def _f(value) -> Optional[float]:
        return float(value) if value is not None else None

    @staticmethod
    def _div(numerator, denominator, round_to: int = 4) -> Optional[float]:
        if numerator is None or denominator is None or denominator == 0:
            return None
        return round(numerator / denominator, round_to)

    @staticmethod
    def _delta(base, stressed):
        if base is None or stressed is None:
            return None, None
        delta = round(stressed - base, 2)
        pct = round(delta / base * 100, 2) if base != 0 else None
        return delta, pct

    @staticmethod
    def _summary(base_equity, stressed_equity, delta, delta_pct) -> str:
        if base_equity is None:
            return "Недостаточно данных: добавьте метрики и бюджет (для P&L)."
        if stressed_equity is None:
            return (
                "Консервативный сценарий: FCF ≤ 0 — оценка не применима "
                "(компания становится убыточной)."
            )
        sign = "снижает" if delta <= 0 else "повышает"
        return (
            f"Консервативный сценарий {sign} оценку на {abs(delta):,.0f} ₽ "
            f"({delta_pct:.1f}%)."
        )


