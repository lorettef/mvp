from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.company import Company
from app.models.financing import Financing
from app.models.metric import Metric
from app.schemas.pnl import PnLResponse
from app.services.hiring_service import HiringService


class PnLService:
    """Расчёт отчёта о прибылях и убытках (P&L)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_pnl(self, company_id: UUID) -> PnLResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        metric = await self._latest(Metric, company_id)
        budget = await self._latest(Budget, company_id)
        settings = await HiringService(self.db).get_settings(company_id)
        credit_interest = await self._financial_expenses(company_id)

        mrr = self._f(metric.mrr) if metric else None
        one_time = 0.0
        revenue = round(mrr + one_time, 2) if mrr is not None else None

        fot = self._f(budget.fot) if budget else None
        marketing = self._f(budget.marketing) if budget else None
        development = self._f(budget.development) if budget else None
        gna = self._f(budget.gna) if budget else None
        social = round(fot * settings.total_rate, 2) if fot is not None else None

        parts = [v for v in (fot, social, marketing, development, gna) if v is not None]
        total_opex = round(sum(parts), 2) if parts else None

        ebitda = (
            round(revenue - total_opex, 2)
            if (revenue is not None and total_opex is not None)
            else None
        )
        net_profit = round(ebitda - credit_interest, 2) if ebitda is not None else None

        ebitda_margin = self._div(ebitda, revenue)
        net_margin = self._div(net_profit, revenue)

        period = metric.period if metric else (budget.period if budget else None)

        return PnLResponse(
            company_id=company_id,
            period=period,
            mrr=mrr,
            one_time_revenue=one_time,
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
            summary=self._summary(ebitda, net_profit, ebitda_margin),
        )

    async def _latest(self, model, company_id: UUID):
        for type_ in ("fact", "plan"):
            result = await self.db.execute(
                select(model)
                .where(model.company_id == company_id, model.type == type_)
                .order_by(model.period.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()
            if row is not None:
                return row
        return None

    async def _financial_expenses(self, company_id: UUID) -> float:
        result = await self.db.execute(
            select(Financing).where(
                Financing.company_id == company_id,
                Financing.type == "credit",
            )
        )
        credits = result.scalars().all()
        total = sum(
            float(c.amount) * (float(c.rate) if c.rate is not None else 0.0)
            for c in credits
        )
        return round(total, 2)

    @staticmethod
    def _f(value) -> Optional[float]:
        return float(value) if value is not None else None

    @staticmethod
    def _div(numerator, denominator, round_to: int = 4) -> Optional[float]:
        if numerator is None or denominator is None or denominator == 0:
            return None
        return round(numerator / denominator, round_to)

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
