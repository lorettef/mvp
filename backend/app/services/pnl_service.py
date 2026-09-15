from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.financing import Financing
from app.schemas.pnl import PnLMonth, PnLResponse
from app.services.common import (
    budget_for_period,
    distinct_periods,
    div,
    f,
    metric_for_period,
)
from app.services.hiring_service import HiringService


def _add_months(period: date, n: int) -> date:
    zero = period.month - 1 + n
    year = period.year + zero // 12
    month = zero % 12 + 1
    return date(year, month, 1)


class PnLService:
    """Расчёт отчёта о прибылях и убытках (P&L).

    Налог на прибыль НЕ моделируется: net_profit = EBITDA − финансовые расходы
    (до налога). При необходимости налоговую модель добавить отдельно.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_pnl(self, company_id: UUID, months: int = 12) -> PnLResponse:
        return await self.compute(company_id, months=months)

    async def compute(self, company_id: UUID, months: int = 12) -> PnLResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        settings = await HiringService(self.db).get_settings(company_id)
        loans = await self._load_loans(company_id)

        periods = await distinct_periods(self.db, company_id, limit=months)
        month_results: List[PnLMonth] = [
            await self._compute_month(company_id, p, settings, loans)
            for p in periods
        ]

        latest = month_results[0] if month_results else None

        return PnLResponse(
            company_id=company_id,
            period=latest.period if latest else None,
            mrr=latest.mrr if latest else None,
            one_time_revenue=0.0,
            revenue=latest.revenue if latest else None,
            fot=latest.fot if latest else None,
            social_payments=latest.social_payments if latest else None,
            marketing=latest.marketing if latest else None,
            development=latest.development if latest else None,
            gna=latest.gna if latest else None,
            total_opex=latest.total_opex if latest else None,
            ebitda=latest.ebitda if latest else None,
            financial_expenses=latest.financial_expenses if latest else 0.0,
            net_profit=latest.net_profit if latest else None,
            ebitda_margin=latest.ebitda_margin if latest else None,
            net_margin=latest.net_margin if latest else None,
            summary=self._summary(
                latest.ebitda if latest else None,
                latest.net_profit if latest else None,
                latest.ebitda_margin if latest else None,
            ),
            months=month_results,
        )

    async def _compute_month(
        self,
        company_id: UUID,
        period,
        settings,
        loans: List[Financing],
    ) -> PnLMonth:
        metric = await metric_for_period(self.db, company_id, period)
        budget = await budget_for_period(self.db, company_id, period)
        credit_interest = self._interest_for_period(loans, period)

        # Источник данных периода (fact/plan/mixed) — не скрываем от downstream.
        source: Optional[str] = None
        if metric is not None or budget is not None:
            m_type = metric.type if metric else None
            b_type = budget.type if budget else None
            if m_type and b_type and m_type != b_type:
                source = "mixed"
            else:
                source = m_type or b_type

        mrr = f(metric.revenue, default=None) if metric else None
        one_time = 0.0
        revenue = round(mrr + one_time, 2) if mrr is not None else None

        fot = f(budget.fot, default=None) if budget else None
        marketing = f(budget.marketing, default=None) if budget else None
        development = f(budget.development, default=None) if budget else None
        gna = f(budget.gna, default=None) if budget else None
        # Соц. платежи работодателя НЕ включают НДФЛ (это налог сотрудника,
        # удерживаемый из gross, а не доп. расход работодателя).
        social = round(fot * settings.employer_rate, 2) if fot is not None else None

        parts = [v for v in (fot, social, marketing, development, gna) if v is not None]
        total_opex = round(sum(parts), 2) if parts else None

        ebitda = (
            round(revenue - total_opex, 2)
            if (revenue is not None and total_opex is not None)
            else None
        )
        net_profit = round(ebitda - credit_interest, 2) if ebitda is not None else None

        ebitda_margin = div(ebitda, revenue, default=None, round_to=4)
        net_margin = div(net_profit, revenue, default=None, round_to=4)

        return PnLMonth(
            period=period,
            source=source,
            mrr=mrr,
            revenue=revenue,
            fot=fot,
            social_payments=social,
            marketing=marketing,
            development=development,
            gna=gna,
            total_opex=total_opex,
            ebitda=ebitda,
            financial_expenses=credit_interest,
            net_profit=net_profit,
            ebitda_margin=ebitda_margin,
            net_margin=net_margin,
        )

    async def _load_loans(self, company_id: UUID) -> List[Financing]:
        result = await self.db.execute(
            select(Financing).where(
                Financing.company_id == company_id,
                Financing.type == "loan",
            )
        )
        return list(result.scalars().all())

    @staticmethod
    def _interest_for_period(loans: List[Financing], period: date) -> float:
        """Месячные проценты по кредитам, активным в `period` (аннуитет)."""
        total = 0.0
        for c in loans:
            total += PnLService._loan_interest(c, period)
        return round(total, 2)

    @staticmethod
    def _loan_interest(loan: Financing, period: date) -> float:
        """Проценты по одному кредиту за `period` с амортизацией principal.

        - до issued_date — 0;
        - без term_months (legacy) — простые проценты (principal не гасится);
        - с term_months — аннуитет: interest = outstanding × rate/12, где
          outstanding уменьшается по schedule от first_payment_date
          (по умолчанию issued_date + 1 мес);
        - после срока (term_months) — 0.
        """
        if loan.issued_date is not None and loan.issued_date > period:
            return 0.0  # кредит ещё не выдан
        rate = (float(loan.annual_rate) / 100.0) if loan.annual_rate is not None else 0.0
        r = rate / 12.0
        if r <= 0:
            return 0.0
        principal = float(loan.amount)
        n = loan.term_months
        if loan.issued_date is None or n is None:
            return principal * r  # legacy / без срока: простые проценты
        first_payment = loan.first_payment_date or _add_months(loan.issued_date, 1)
        if period < first_payment:
            return principal * r  # grace: проценты на полный principal
        k = (period.year - first_payment.year) * 12 + (period.month - first_payment.month) + 1
        if k > n:
            return 0.0  # кредит погашен
        outstanding = principal * ((1 + r) ** n - (1 + r) ** (k - 1)) / ((1 + r) ** n - 1)
        return outstanding * r

    @staticmethod
    def _summary(
        ebitda: Optional[float],
        net_profit: Optional[float],
        ebitda_margin: Optional[float],
    ) -> str:
        if ebitda is None:
            return "Недостаточно данных: добавьте метрики и бюджет, чтобы рассчитать P&L."
        margin = f" (маржа {ebitda_margin:.1%})" if ebitda_margin is not None else ""
        if net_profit is None:
            return f"EBITDA = {ebitda:,.0f} ₽{margin}."
        sign = "прибыль" if net_profit >= 0 else "убыток"
        return (
            f"EBITDA = {ebitda:,.0f} ₽{margin}. "
            f"Чистая {sign} = {abs(net_profit):,.0f} ₽."
        )
