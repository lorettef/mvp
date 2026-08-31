from datetime import date
from typing import List, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.financing import Financing
from app.schemas.credit import (
    CashProjectionMonth,
    CreditForecastResponse,
    CreditGap,
)
from app.services.market_service import GEOGRAPHIES, normalize_geography
from app.services.pnl_service import PnLService

MONTHLY_REVENUE_GROWTH = 0.05
OPEX_GROWTH = 0.0
BUFFER = 0.10
RATE_PREMIUM = 5.0
HORIZON_MONTHS = 12


class CreditService:
    """Умное прогнозирование кредитов: кассовые разрывы + сумма и ставка кредита."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def forecast(self, company_id: UUID) -> CreditForecastResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        pnl = await PnLService(self.db).get_pnl(company_id)
        geography = normalize_geography(company.geography)
        key_rate = GEOGRAPHIES[geography]["key_rate"]
        credit_rate = round(key_rate + RATE_PREMIUM, 2)

        opening_cash = await self._financing_total(company_id)
        base_revenue = pnl.mrr
        base_opex = pnl.total_opex if pnl.total_opex is not None else 0.0

        if base_revenue is None:
            return CreditForecastResponse(
                company_id=company_id,
                geography=geography,
                key_rate=key_rate,
                credit_rate=credit_rate,
                opening_cash=opening_cash,
                base_revenue=None,
                base_opex=base_opex,
                months=[],
                gaps=[],
                total_credit_needed=0.0,
                summary=(
                    "Недостаточно данных: добавьте метрики (MRR), "
                    "чтобы построить Cash Flow прогноз."
                ),
            )

        months, gaps = self._project(
            base_revenue, base_opex, opening_cash, credit_rate
        )
        total_credit = round(sum(g.credit_amount for g in gaps), 2)

        if not gaps:
            min_balance = min(m.balance_before for m in months)
            summary = (
                f"Кассовых разрывов не прогнозируется на {HORIZON_MONTHS} мес. "
                f"Минимальный остаток = {min_balance:,.0f} ₽."
            )
        else:
            summary = (
                f"Обнаружено кассовых разрывов: {len(gaps)}. "
                f"Требуется кредит ≈ {total_credit:,.0f} ₽ "
                f"(разрыв + буфер {BUFFER:.0%}) по ставке {credit_rate:.1f}%."
            )

        return CreditForecastResponse(
            company_id=company_id,
            geography=geography,
            key_rate=key_rate,
            credit_rate=credit_rate,
            opening_cash=opening_cash,
            base_revenue=base_revenue,
            base_opex=base_opex,
            months=months,
            gaps=gaps,
            total_credit_needed=total_credit,
            summary=summary,
        )

    def _project(
        self,
        base_revenue: float,
        base_opex: float,
        opening_cash: float,
        credit_rate: float,
    ) -> Tuple[List[CashProjectionMonth], List[CreditGap]]:
        balance = opening_cash
        months: List[CashProjectionMonth] = []
        gaps: List[CreditGap] = []
        for m in range(1, HORIZON_MONTHS + 1):
            period = self._period_for_month(m)
            revenue = round(base_revenue * (1 + MONTHLY_REVENUE_GROWTH) ** m, 2)
            opex = round(base_opex * (1 + OPEX_GROWTH) ** m, 2)
            net_cf = round(revenue - opex, 2)
            balance_before = round(balance + net_cf, 2)
            balance_after = balance_before
            if balance_before < 0:
                gap = round(-balance_before, 2)
                credit = round(gap * (1 + BUFFER), 2)
                balance_after = round(balance_before + credit, 2)
                gaps.append(
                    CreditGap(
                        month=m,
                        period=period,
                        balance_before=balance_before,
                        gap=gap,
                        credit_amount=credit,
                        rate=credit_rate,
                    )
                )
            months.append(
                CashProjectionMonth(
                    month=m,
                    period=period,
                    revenue=revenue,
                    opex=opex,
                    net_cf=net_cf,
                    balance_before=balance_before,
                    balance_after=balance_after,
                )
            )
            balance = balance_after
        return months, gaps

    async def _financing_total(self, company_id: UUID) -> float:
        result = await self.db.execute(
            select(func.sum(Financing.amount)).where(
                Financing.company_id == company_id
            )
        )
        total = result.scalar_one_or_none()
        return round(float(total), 2) if total is not None else 0.0

    @staticmethod
    def _period_for_month(m: int) -> date:
        today = date.today()
        zero_month = today.month - 1 + m
        year = today.year + zero_month // 12
        month = zero_month % 12 + 1
        return date(year, month, 1)
