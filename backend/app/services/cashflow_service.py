from typing import List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financing import Financing
from app.schemas.cashflow import CashFlowMonth, CashFlowResponse
from app.schemas.pnl import PnLResponse
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
        result = await self.db.execute(
            select(Financing).where(Financing.company_id == company_id)
        )
        financings = list(result.scalars().all())
        investments = round(sum(float(f.amount) for f in financings if f.type == "investment"), 2)
        credits = round(sum(float(f.amount) for f in financings if f.type == "loan"), 2)
        financing_cf = round(investments + credits, 2)

        # Накопление остатка идёт в ХРОНОЛОГИЧЕСКОМ порядке (старый → новый),
        # а pnl.months приходит DESC (новый → старый) — разворачиваем перед
        # расчётом и обратно для вывода.
        chronological = list(reversed(pnl.months))
        first_period = chronological[0].period if chronological else None
        month_results: List[CashFlowMonth] = []
        running = 0.0
        for m in chronological:
            net_profit = m.net_profit
            operating_cf = (
                round(net_profit + AMORTIZATION, 2) if net_profit is not None else None
            )
            investing_cf = round(-CAPEX, 2)
            financing_cf_month = self._financing_in_month(
                financings, m.period, first_period
            )
            month_total_cf = (
                round(operating_cf + investing_cf + financing_cf_month, 2)
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
                    financing_cf=financing_cf_month,
                    total_cf=month_total_cf,
                    net_cash_flow=month_total_cf,
                    closing_balance=closing,
                )
            )
            running = closing

        month_results.reverse()
        latest = month_results[0] if month_results else None

        latest_operating = latest.operating_cf if latest else None
        closing_balance = latest.closing_balance if latest else None
        # net_cash_flow = closing_balance - opening_balance (чистый поток за период),
        # а НЕ синоним closing_balance. При opening=0 численно совпадает, но
        # разделяется семантически и становится разным после Phase 4.
        net_cash_flow = round(closing_balance, 2) if closing_balance is not None else None
        total_cf = net_cash_flow

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
            net_cash_flow=net_cash_flow,
            opening_balance=0.0,
            closing_balance=closing_balance,
            summary=self._summary(latest_operating, financing_cf, closing_balance),
            months=month_results,
        )

    @staticmethod
    def _financing_in_month(financings, period, first_period) -> float:
        """Сумма финансирования, поступившего в `period` (по issued_date).

        Записи без issued_date (legacy) и с датой раньше первого периода
        относятся к первому периоду (t0).
        """
        total = 0.0
        for f in financings:
            issued = f.issued_date
            if issued is None or issued < period:
                if period == first_period:
                    total += float(f.amount)
            elif issued.year == period.year and issued.month == period.month:
                total += float(f.amount)
        return round(total, 2)

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
