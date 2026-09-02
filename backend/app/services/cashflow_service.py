from typing import Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.cashflow import CashFlowResponse
from app.schemas.pnl import PnLResponse
from app.services.common import financing_sums
from app.services.pnl_service import PnLService

AMORTIZATION = 0.0
CAPEX = 0.0
OPENING_BALANCE = 0.0


class CashFlowService:
    """Расчёт отчёта о движении денежных средств (Cash Flow)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_cashflow(self, company_id: UUID) -> CashFlowResponse:
        pnl = await PnLService(self.db).get_pnl(company_id)
        return await self.compute(pnl, company_id)

    async def compute(self, pnl: PnLResponse, company_id: UUID) -> CashFlowResponse:
        sums = await financing_sums(self.db, company_id)
        investments = sums.cash
        credits = sums.debt
        financing_cf = round(investments + credits, 2)

        net_profit = pnl.net_profit
        operating_cf = (
            round(net_profit + AMORTIZATION, 2) if net_profit is not None else None
        )
        investing_cf = round(-CAPEX, 2)
        total_cf = (
            round(operating_cf + investing_cf + financing_cf, 2)
            if operating_cf is not None
            else None
        )
        closing = (
            round(OPENING_BALANCE + total_cf, 2) if total_cf is not None else None
        )

        return CashFlowResponse(
            company_id=company_id,
            period=pnl.period,
            net_profit=net_profit,
            amortization=AMORTIZATION,
            operating_cf=operating_cf,
            capex=CAPEX,
            investing_cf=investing_cf,
            investments=investments,
            credits=credits,
            financing_cf=financing_cf,
            total_cf=total_cf,
            opening_balance=OPENING_BALANCE,
            closing_balance=closing,
            summary=self._summary(operating_cf, financing_cf, closing),
        )

    @staticmethod
    def _summary(
        operating_cf: Optional[float],
        financing_cf: float,
        closing: Optional[float],
    ) -> str:
        if closing is None:
            return "Недостаточно данных: добавьте метрики и бюджет (для P&L), чтобы рассчитать Cash Flow."
        return (
            f"Операционный CF = {operating_cf:,.0f} ₽, "
            f"финансовый CF = {financing_cf:,.0f} ₽. "
            f"Остаток на конец месяца = {closing:,.0f} ₽."
        )
