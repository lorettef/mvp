from typing import List, Optional
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.cashflow import CashFlowMonth, CashFlowResponse
from app.schemas.pnl import PnLResponse
from app.services.common import financing_sums
from app.services.pnl_service import PnLService

AMORTIZATION = 0.0
CAPEX = 0.0


class CashFlowService:
    """Расчёт отчёта о движении денежных средств (Cash Flow)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_cashflow(self, company_id: UUID, months: int = 12) -> CashFlowResponse:
        pnl = await PnLService(self.db).get_pnl(company_id, months=months)
        return await self.compute(pnl, company_id)

    async def compute(self, pnl: PnLResponse, company_id: UUID) -> CashFlowResponse:
        sums = await financing_sums(self.db, company_id)
        investments = sums.cash
        credits = sums.debt
        financing_cf = round(investments + credits, 2)

        # Накопление остатка идёт в ХРОНОЛОГИЧЕСКОМ порядке (старый → новый),
        # а pnl.months приходит DESC (новый → старый) — разворачиваем перед
        # расчётом и обратно для вывода.
        chronological = list(reversed(pnl.months))
        month_results: List[CashFlowMonth] = []
        running = financing_cf
        for m in chronological:
            net_profit = m.net_profit
            operating_cf = (
                round(net_profit + AMORTIZATION, 2) if net_profit is not None else None
            )
            investing_cf = round(-CAPEX, 2)
            month_total_cf = (
                round(operating_cf + investing_cf, 2)
                if operating_cf is not None
                else None
            )
            closing = (
                round(running + month_total_cf, 2)
                if month_total_cf is not None
                else running
            )
            month_results.append(
                CashFlowMonth(
                    period=m.period,
                    net_profit=net_profit,
                    operating_cf=operating_cf,
                    investing_cf=investing_cf,
                    financing_cf=0.0,
                    total_cf=month_total_cf,
                    closing_balance=closing,
                )
            )
            running = closing

        month_results.reverse()
        latest = month_results[0] if month_results else None

        # Top-level согласован с месячной разбивкой: closing_balance — итоговый
        # накопленный остаток (последний месяц), total_cf — прирост к opening.
        latest_operating = latest.operating_cf if latest else None
        closing_balance = latest.closing_balance if latest else None
        total_cf = (
            round(closing_balance, 2) if closing_balance is not None else None
        )

        return CashFlowResponse(
            company_id=company_id,
            period=latest.period if latest else None,
            net_profit=latest.net_profit if latest else None,
            amortization=AMORTIZATION,
            operating_cf=latest_operating,
            capex=CAPEX,
            investing_cf=round(-CAPEX, 2),
            investments=investments,
            credits=credits,
            financing_cf=financing_cf,
            total_cf=total_cf,
            opening_balance=0.0,
            closing_balance=closing_balance,
            summary=self._summary(latest_operating, financing_cf, closing_balance),
            months=month_results,
        )

    @staticmethod
    def _summary(
        operating_cf: Optional[float],
        financing_cf: float,
        closing: Optional[float],
    ) -> str:
        if operating_cf is None or closing is None:
            return "Недостаточно данных: добавьте метрики и бюджет (для P&L), чтобы рассчитать Cash Flow."
        return (
            f"Операционный CF = {operating_cf:,.0f} ₽, "
            f"финансовый CF = {financing_cf:,.0f} ₽. "
            f"Остаток на конец месяца = {closing:,.0f} ₽."
        )
