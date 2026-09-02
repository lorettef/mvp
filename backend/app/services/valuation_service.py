from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.schemas.pnl import PnLResponse
from app.schemas.valuation import ValuationResponse
from app.services.cashflow_service import CashFlowService
from app.services.common import div, financing_sums
from app.services.hiring_service import HiringService
from app.services.market_service import GEOGRAPHIES, normalize_geography
from app.services.pnl_service import PnLService

RISK_PREMIUM = 10.0
MONTHS_IN_YEAR = 12


class ValuationService:
    """Оценка бизнеса по модели Гордона (TV + мультипликаторы)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_valuation(
        self, company_id: UUID, pnl: Optional[PnLResponse] = None
    ) -> ValuationResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        geography = normalize_geography(company.geography)
        key_rate = GEOGRAPHIES[geography]["key_rate"]
        discount_rate = round(key_rate + RISK_PREMIUM, 2)
        growth_rate = round(GEOGRAPHIES[geography]["inflation"], 2)

        if pnl is None:
            pnl = await PnLService(self.db).get_pnl(company_id)
        cashflow = await CashFlowService(self.db).compute(pnl, company_id)
        fcf = cashflow.operating_cf

        sums = await financing_sums(self.db, company_id)
        debt, cash = sums.debt, sums.cash
        net_debt = round(debt - cash, 2)

        revenue_annual = round(pnl.mrr * MONTHS_IN_YEAR, 2) if pnl.mrr is not None else None

        hiring = await HiringService(self.db).build_plan(company_id)
        headcount = hiring.final_headcount

        terminal_value, equity_value = self._gordon(
            fcf, discount_rate, growth_rate, net_debt
        )

        ps_ratio = div(equity_value, revenue_annual, default=None)
        value_per_employee = (
            div(equity_value, float(headcount), default=None, round_to=2)
            if headcount > 0
            else None
        )

        return ValuationResponse(
            company_id=company_id,
            geography=geography,
            key_rate=key_rate,
            discount_rate=discount_rate,
            growth_rate=growth_rate,
            fcf=fcf,
            terminal_value=terminal_value,
            debt=debt,
            cash=cash,
            net_debt=net_debt,
            equity_value=equity_value,
            revenue_annual=revenue_annual,
            ps_ratio=ps_ratio,
            headcount=headcount,
            value_per_employee=value_per_employee,
            summary=self._summary(fcf, terminal_value, equity_value, ps_ratio, value_per_employee),
        )

    @staticmethod
    def _gordon(
        fcf: Optional[float],
        discount_rate: float,
        growth_rate: float,
        net_debt: float,
    ):
        if fcf is None or fcf <= 0:
            return None, None
        r = discount_rate / 100.0
        g = growth_rate / 100.0
        if r <= g:
            return None, None
        tv = round(fcf * (1 + g) / (r - g), 2)
        equity = round(tv - net_debt, 2)
        return tv, equity

    @staticmethod
    def _summary(fcf, tv, equity, ps, vpe) -> str:
        if fcf is None:
            return "Недостаточно данных: добавьте метрики и бюджет (для P&L/Cash Flow)."
        if fcf <= 0:
            return "FCF ≤ 0 — модель Гордона неприменима (компания убыточна)."
        parts = [f"Оценка (Equity Value) = {equity:,.0f} ₽ (TV = {tv:,.0f} ₽)."]
        if ps is not None:
            parts.append(f"P/S = {ps:.2f}×.")
        if vpe is not None:
            parts.append(f"На сотрудника = {vpe:,.0f} ₽.")
        return " ".join(parts)
