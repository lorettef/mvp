from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.financing import Financing
from app.schemas.valuation import ValuationResponse
from app.services.cashflow_service import CashFlowService
from app.services.hiring_service import HiringService
from app.services.market_service import GEOGRAPHIES
from app.services.pnl_service import PnLService

RISK_PREMIUM = 10.0
DEFAULT_GEOGRAPHY = "RU"
MONTHS_IN_YEAR = 12


class ValuationService:
    """Оценка бизнеса по модели Гордона (TV + мультипликаторы)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_valuation(self, company_id: UUID) -> ValuationResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        geography = self._normalize_geography(company.geography)
        key_rate = GEOGRAPHIES[geography]["key_rate"]
        discount_rate = round(key_rate + RISK_PREMIUM, 2)
        growth_rate = round(GEOGRAPHIES[geography]["inflation"], 2)

        cashflow = await CashFlowService(self.db).get_cashflow(company_id)
        fcf = cashflow.operating_cf

        debt, cash = await self._debt_and_cash(company_id)
        net_debt = round(debt - cash, 2)

        pnl = await PnLService(self.db).get_pnl(company_id)
        revenue_annual = round(pnl.mrr * MONTHS_IN_YEAR, 2) if pnl.mrr is not None else None

        hiring = await HiringService(self.db).generate_plan(company_id)
        headcount = hiring.final_headcount

        terminal_value, equity_value = self._gordon(
            fcf, discount_rate, growth_rate, net_debt
        )

        ps_ratio = self._div(equity_value, revenue_annual)
        value_per_employee = (
            self._div(equity_value, float(headcount), round_to=2)
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

    async def _debt_and_cash(self, company_id: UUID):
        result = await self.db.execute(
            select(Financing.type, func.sum(Financing.amount))
            .where(Financing.company_id == company_id)
            .group_by(Financing.type)
        )
        debt = 0.0
        cash = 0.0
        for type_, total in result.all():
            if total is None:
                continue
            if type_ == "credit":
                debt += float(total)
            else:
                cash += float(total)
        return round(debt, 2), round(cash, 2)

    @staticmethod
    def _normalize_geography(geography: Optional[str]) -> str:
        key = (geography or DEFAULT_GEOGRAPHY).strip().upper()
        return key if key in GEOGRAPHIES else DEFAULT_GEOGRAPHY

    @staticmethod
    def _div(numerator, denominator, round_to: int = 4) -> Optional[float]:
        if numerator is None or denominator is None or denominator == 0:
            return None
        return round(numerator / denominator, round_to)

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
