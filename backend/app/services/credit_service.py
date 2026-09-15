from datetime import date
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.schemas.credit import (
    CashProjectionMonth,
    CreditForecastResponse,
    CreditGap,
)
from app.schemas.pnl import PnLResponse
from app.services.cashflow_service import CashFlowService
from app.services.common import latest_metrics, period_for_month
from app.services.hiring_service import HiringService
from app.services.market_service import GEOGRAPHIES, normalize_geography
from app.services.pnl_service import PnLService

BUFFER = 0.10
RATE_PREMIUM = 5.0
HORIZON_MONTHS = 12


class CreditService:
    """Умное прогнозирование кредитов: кассовые разрывы + сумма и ставка кредита."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def forecast(
        self, company_id: UUID, pnl: Optional[PnLResponse] = None
    ) -> CreditForecastResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        if pnl is None:
            pnl = await PnLService(self.db).get_pnl(company_id)
        geography = normalize_geography(company.geography)
        key_rate = GEOGRAPHIES[geography]["key_rate"]
        credit_rate = round(key_rate + RATE_PREMIUM, 2)

        # opening_cash — фактический остаток из Cash Flow (реальные транзакции),
        # а не сумма финансирования.
        cashflow = await CashFlowService(self.db).compute(pnl, company_id)
        opening_cash = round(float(cashflow.closing_balance or 0.0), 2)
        base_revenue = pnl.mrr
        base_opex = pnl.total_opex if pnl.total_opex is not None else 0.0
        # Non-payroll OPEX (маркетинг + разработка + G&A) — БЕЗ ФОТ.
        # Payroll считается отдельно canonical-движком (HiringTeam + approved),
        # чтобы не было второго независимого payroll-источника.
        base_non_payroll = round(
            (pnl.marketing or 0.0) + (pnl.development or 0.0) + (pnl.gna or 0.0), 2
        )

        if base_revenue is None:
            return CreditForecastResponse(
                company_id=company_id,
                geography=geography,
                key_rate=key_rate,
                credit_rate=credit_rate,
                opening_cash=opening_cash,
                base_revenue=None,
                base_opex=base_opex,
                revenue_growth=0.0,
                opex_growth=0.0,
                months=[],
                gaps=[],
                funding_need=0.0,
                total_credit_needed=0.0,
                summary=(
                    "Недостаточно данных: добавьте метрики (выручка), "
                    "чтобы построить Cash Flow прогноз."
                ),
            )

        revenue_growth = await self._revenue_growth(company_id)
        opex_growth = 0.0  # консервативно: расходы без роста, если нет явного плана

        # Ежемесячное обслуживание существующего долга (проценты) уже учтено
        # в pnl.financial_expenses (месячная сумма).
        monthly_debt_service = pnl.financial_expenses

        # Canonical payroll: current team (HiringTeam) + одобренный найм,
        # с фолбэком на budget.fot (legacy) — единый source of truth.
        hiring = await HiringService(self.db).build_plan(company_id)
        payroll_by_period = self._canonical_payroll(hiring, pnl)

        months, gaps = self._project(
            base_revenue, base_non_payroll, opening_cash, credit_rate,
            monthly_debt_service, revenue_growth, opex_growth,
            payroll_by_period,
        )
        funding_need = round(sum(g.credit_amount for g in gaps), 2)

        if not gaps:
            min_balance = min(m.balance_before for m in months)
            summary = (
                f"Кассовых разрывов не прогнозируется на {HORIZON_MONTHS} мес. "
                f"Минимальный остаток = {min_balance:,.0f} ₽."
            )
        else:
            summary = (
                f"Обнаружено кассовых разрывов: {len(gaps)}. "
                f"Потребность в финансировании ≈ {funding_need:,.0f} ₽ "
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
            revenue_growth=revenue_growth,
            opex_growth=opex_growth,
            months=months,
            gaps=gaps,
            funding_need=funding_need,
            total_credit_needed=funding_need,
            summary=summary,
        )

    async def _revenue_growth(self, company_id: UUID) -> float:
        """Консервативный месячный рост выручки: PLAN → факт-динамика → 0%."""
        for prefer in ("plan", "fact"):
            rows = await latest_metrics(
                self.db, company_id, prefer=prefer, fallback=False, limit=2
            )
            if len(rows) >= 2:
                later, earlier = float(rows[0].revenue), float(rows[1].revenue)
                if earlier > 0:
                    return round(later / earlier - 1, 4)
        return 0.0

    @staticmethod
    def _canonical_payroll(hiring, pnl) -> Dict[date, float]:
        """Canonical forecast payroll: текущая команда + одобренный найм.

        Возвращает полную employer cost (gross + взносы) по месяцам.
        Фолбэк: если HiringTeam пуст (legacy-компания без структурированной
        команды) — плоский budget.fot + social, чтобы не обнулять payroll.
        """
        if hiring.team:
            return {m.period: m.payroll for m in hiring.months}
        flat = round((pnl.fot or 0.0) + (pnl.social_payments or 0.0), 2)
        return {m.period: round(flat + m.hires_payroll, 2) for m in hiring.months}

    def _project(
        self,
        base_revenue: float,
        base_non_payroll: float,
        opening_cash: float,
        credit_rate: float,
        monthly_debt_service: float,
        revenue_growth: float,
        opex_growth: float,
        payroll_by_period: Optional[Dict[date, float]] = None,
    ) -> Tuple[List[CashProjectionMonth], List[CreditGap]]:
        balance = opening_cash
        months: List[CashProjectionMonth] = []
        gaps: List[CreditGap] = []
        extra_debt_service = 0.0  # обслуживание рекомендованных кредитов
        for m in range(1, HORIZON_MONTHS + 1):
            period = period_for_month(m)
            revenue = round(base_revenue * (1 + revenue_growth) ** m, 2)
            payroll = (payroll_by_period or {}).get(period, 0.0)
            opex = round(base_non_payroll * (1 + opex_growth) ** m + payroll, 2)
            service = round(monthly_debt_service + extra_debt_service, 2)
            net_cf = round(revenue - opex - service, 2)
            balance_before = round(balance + net_cf, 2)
            balance_after = balance_before
            if balance_before < 0:
                gap = round(-balance_before, 2)
                credit = round(gap * (1 + BUFFER), 2)
                remaining = HORIZON_MONTHS - m + 1
                # Рекомендованный кредит создаёт будущее обслуживание долга.
                extra_debt_service += self._annuity_payment(
                    credit, credit_rate, remaining
                )
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

    @staticmethod
    def _annuity_payment(principal: float, annual_rate: float, months: int) -> float:
        """Аннуитетный ежемесячный платёж по кредиту (interest + principal)."""
        r = annual_rate / 100.0 / 12.0
        if r <= 0:
            return round(principal / months, 2)
        return round(
            principal * r * (1 + r) ** months / ((1 + r) ** months - 1), 2
        )
