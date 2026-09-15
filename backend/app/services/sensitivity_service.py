from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.schemas.pnl import PnLResponse
from app.schemas.sensitivity import Scenario, SensitivityResponse, StressItem
from app.services.common import div, f, latest_metrics
from app.services.market_service import GEOGRAPHIES, normalize_geography
from app.services.pnl_service import PnLService
from app.services.valuation_service import ValuationService

SALES_STRESS = 0.9
CAC_STRESS = 1.1
LTV_STRESS = 0.95
CHURN_STRESS = 1.1
CHURN_GROWTH_SENSITIVITY = 2.0  # +1 п.п. churn → −2 п.п. годового роста


class SensitivityService:
    """Анализ чувствительности: консервативный сценарий vs базовый."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def analyze(
        self, company_id: UUID, pnl: Optional[PnLResponse] = None
    ) -> SensitivityResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        geography = normalize_geography(company.geography)
        key_rate = GEOGRAPHIES[geography]["key_rate"]
        discount_rate = round(key_rate + 10.0, 2)

        valuation = await ValuationService(self.db).get_valuation(company_id, pnl=pnl)
        if pnl is None:
            pnl = await PnLService(self.db).get_pnl(company_id)
        rows = await latest_metrics(
            self.db, company_id, prefer="fact", fallback=True, limit=1
        )
        metric = rows[0] if rows else None

        mrr = pnl.mrr
        marketing = pnl.marketing or 0.0
        development = pnl.development or 0.0
        fot = pnl.fot or 0.0
        gna = pnl.gna or 0.0
        social = pnl.social_payments or 0.0
        financial_expenses = pnl.financial_expenses

        cac = f(metric.cac, None) if metric else None
        ltv = f(metric.ltv, None) if metric else None
        churn = float(metric.churn) if metric and metric.churn is not None else None

        if mrr is None:
            return SensitivityResponse(
                company_id=company_id,
                geography=geography,
                key_rate=key_rate,
                discount_rate=discount_rate,
                base=Scenario(),
                conservative=Scenario(),
                summary="Недостаточно данных: добавьте метрики (выручка).",
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
            ltv_cac=div(ltv, cac, None, round_to=4),
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

        delta_churn_pp = (
            (stressed_churn - churn) * 100.0
            if stressed_churn is not None and churn is not None
            else 0.0
        )
        stressed_growth = round(
            max(0.0, valuation.growth_rate - CHURN_GROWTH_SENSITIVITY * delta_churn_pp),
            2,
        )

        stressed_fcf_annual = (
            round(stressed_net_profit * 12, 2)
            if stressed_net_profit is not None
            else None
        )
        stressed_tv, stressed_equity = ValuationService._gordon(
            stressed_fcf_annual,
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
            ltv_cac=div(stressed_ltv, stressed_cac, None, round_to=4),
        )

        equity_delta, equity_delta_pct = self._delta(
            base.equity_value, stressed_equity
        )

        # Раздельные стресс-сценарии: каждый фактор по отдельности + combined.
        base_net = valuation.fcf
        base_equity = valuation.equity_value
        base_growth = valuation.growth_rate
        net_debt = valuation.net_debt

        def _eq(net_profit, growth):
            fcf_annual = round(net_profit * 12, 2) if net_profit is not None else None
            _, eq = ValuationService._gordon(fcf_annual, discount_rate, growth, net_debt)
            return eq

        opex_without_marketing = round(development + fot + gna + social, 2)
        rev_net = round(
            stressed_mrr - (marketing + opex_without_marketing) - financial_expenses, 2
        )
        cac_net = round(
            mrr - (stressed_marketing + opex_without_marketing) - financial_expenses, 2
        )

        stresses: List[StressItem] = []
        for name, net, growth in [
            ("revenue", rev_net, base_growth),
            ("cac", cac_net, base_growth),
            ("churn", base_net, stressed_growth),
            ("combined", stressed_net_profit, stressed_growth),
        ]:
            eq = _eq(net, growth)
            delta, pct = self._delta(base_equity, eq)
            stresses.append(
                StressItem(
                    name=name,
                    equity_value=eq,
                    equity_delta=delta,
                    equity_delta_pct=pct,
                )
            )

        return SensitivityResponse(
            company_id=company_id,
            geography=geography,
            key_rate=key_rate,
            discount_rate=discount_rate,
            base=base,
            conservative=conservative,
            stresses=stresses,
            equity_delta=equity_delta,
            equity_delta_pct=equity_delta_pct,
            summary=self._summary(base.equity_value, stressed_equity, equity_delta, equity_delta_pct),
        )

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


