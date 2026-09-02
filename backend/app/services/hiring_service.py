from datetime import date
from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.hiring_plan import HiringPlan
from app.models.hiring_settings import HiringSettings
from app.schemas.hiring import (
    HiringMonthRow,
    HiringPlanResponse,
    HiringSettingsResponse,
    HiringSettingsUpsert,
    DEFAULT_NDFL_RATE,
    DEFAULT_INSURANCE_RATE,
    DEFAULT_INJURY_RATE,
)
from app.services.common import latest_metrics, period_for_month

# Отраслевые коэффициенты распределения штата (доля от общего числа сотрудников).
INDUSTRY_STAFF_MIX = {
    "saas": {"dev": 0.40, "sales": 0.25, "marketing": 0.35},
    "fintech": {"dev": 0.45, "sales": 0.20, "marketing": 0.35},
    "ecommerce": {"dev": 0.30, "sales": 0.30, "marketing": 0.40},
    "edtech": {"dev": 0.40, "sales": 0.30, "marketing": 0.30},
    "healthtech": {"dev": 0.45, "sales": 0.25, "marketing": 0.30},
    "ai": {"dev": 0.60, "sales": 0.15, "marketing": 0.25},
    "marketplaces": {"dev": 0.30, "sales": 0.25, "marketing": 0.45},
    "foodtech": {"dev": 0.30, "sales": 0.35, "marketing": 0.35},
    "logistics": {"dev": 0.35, "sales": 0.25, "marketing": 0.40},
    "proptech": {"dev": 0.40, "sales": 0.30, "marketing": 0.30},
    "media": {"dev": 0.35, "sales": 0.30, "marketing": 0.35},
    "hardware": {"dev": 0.55, "sales": 0.20, "marketing": 0.25},
    "biotech": {"dev": 0.55, "sales": 0.15, "marketing": 0.30},
    "cleantech": {"dev": 0.50, "sales": 0.20, "marketing": 0.30},
    "other": {"dev": 0.40, "sales": 0.30, "marketing": 0.30},
}

INDUSTRY_LABELS = {
    "saas": "SaaS",
    "fintech": "Fintech",
    "ecommerce": "E-commerce",
    "edtech": "EdTech",
    "healthtech": "HealthTech",
    "ai": "AI/ML",
    "other": "Другое",
}

# Согласованные параметры алгоритма (TZ v5.0, раздел 10).
FOT_SHARE = 0.35        # Бюджет на ФОТ = 35% от прогнозного MRR (диапазон 30–40%)
AVG_SALARY = 150000.0   # Средняя зарплата сотрудника в месяц, ₽
MONTHLY_GROWTH = 0.05   # Ежемесячный рост прогнозного MRR (5%)
HORIZON_MONTHS = 12     # Горизонт прогноза, месяцев


class HiringService:
    """Прогноз найма сотрудников на 12 месяцев с учётом соц. платежей."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _normalize_industry(industry: Optional[str]) -> str:
        key = (industry or "other").strip().lower()
        return key if key in INDUSTRY_STAFF_MIX else "other"

    @staticmethod
    def _sum_rate(ndfl: float, insurance: float, injury: float) -> float:
        return round(ndfl + insurance + injury, 4)

    async def get_settings(self, company_id: UUID) -> HiringSettingsResponse:
        result = await self.db.execute(
            select(HiringSettings).where(HiringSettings.company_id == company_id)
        )
        row = result.scalar_one_or_none()
        ndfl = float(row.ndfl_rate) if row else DEFAULT_NDFL_RATE
        insurance = float(row.insurance_rate) if row else DEFAULT_INSURANCE_RATE
        injury = float(row.injury_rate) if row else DEFAULT_INJURY_RATE
        return HiringSettingsResponse(
            company_id=company_id,
            ndfl_rate=ndfl,
            insurance_rate=insurance,
            injury_rate=injury,
            total_rate=self._sum_rate(ndfl, insurance, injury),
        )

    async def upsert_settings(
        self, company_id: UUID, data: HiringSettingsUpsert
    ) -> HiringSettingsResponse:
        result = await self.db.execute(
            select(HiringSettings).where(HiringSettings.company_id == company_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = HiringSettings(company_id=company_id)
            self.db.add(row)
        row.ndfl_rate = data.ndfl_rate
        row.insurance_rate = data.insurance_rate
        row.injury_rate = data.injury_rate
        await self.db.flush()
        return HiringSettingsResponse(
            company_id=company_id,
            ndfl_rate=data.ndfl_rate,
            insurance_rate=data.insurance_rate,
            injury_rate=data.injury_rate,
            total_rate=self._sum_rate(
                data.ndfl_rate, data.insurance_rate, data.injury_rate
            ),
        )

    async def build_plan(self, company_id: UUID) -> HiringPlanResponse:
        """Рассчитать целевой штат на 12 месяцев (без сохранения в БД)."""
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        industry = self._normalize_industry(company.industry)
        mix = INDUSTRY_STAFF_MIX[industry]
        settings = await self.get_settings(company_id)
        rows = await latest_metrics(
            self.db, company_id, prefer="plan", fallback=True, limit=1
        )
        base_revenue = float(rows[0].revenue) if rows else None

        if base_revenue is None:
            return HiringPlanResponse(
                company_id=company_id,
                industry=industry,
                industry_label=INDUSTRY_LABELS[industry],
                base_revenue=None,
                fot_share=FOT_SHARE,
                avg_salary=AVG_SALARY,
                monthly_growth=MONTHLY_GROWTH,
                settings=settings,
                months=[],
                final_headcount=0,
                summary=(
                    "Метрики выручки не найдены. Добавьте метрики (План или Факт), "
                    "чтобы рассчитать прогноз найма."
                ),
            )

        months: List[HiringMonthRow] = []
        for m in range(1, HORIZON_MONTHS + 1):
            period = period_for_month(m)
            revenue = round(base_revenue * (1 + MONTHLY_GROWTH) ** m, 2)
            fot = round(revenue * FOT_SHARE, 2)
            social = round(fot * settings.total_rate, 2)
            total_cost = round(fot + social, 2)
            headcount = max(1, int(fot / AVG_SALARY))
            dev = round(headcount * mix["dev"])
            sales = round(headcount * mix["sales"])
            marketing = headcount - dev - sales  # гарантирует сумму = headcount
            months.append(
                HiringMonthRow(
                    month=m,
                    period=period,
                    revenue=revenue,
                    fot=fot,
                    social_payments=social,
                    total_cost=total_cost,
                    headcount=headcount,
                    dev_count=dev,
                    sales_count=sales,
                    marketing_count=marketing,
                )
            )

        final = months[-1]
        summary = (
            f"Целевой штат «{INDUSTRY_LABELS[industry]}» через {HORIZON_MONTHS} мес. — "
            f"{final.headcount} чел. (ФОТ ≈ {final.fot:,.0f} ₽/мес). "
            f"Бюджет ФОТ = {FOT_SHARE:.0%} от выручки, соц. платежи {settings.total_rate:.1%}."
        )

        return HiringPlanResponse(
            company_id=company_id,
            industry=industry,
            industry_label=INDUSTRY_LABELS[industry],
            base_revenue=base_revenue,
            fot_share=FOT_SHARE,
            avg_salary=AVG_SALARY,
            monthly_growth=MONTHLY_GROWTH,
            settings=settings,
            months=months,
            final_headcount=final.headcount,
            summary=summary,
        )

    async def generate_plan(self, company_id: UUID) -> HiringPlanResponse:
        """Рассчитать целевой штат и сохранить его в hiring_plans."""
        plan = await self.build_plan(company_id)
        for m in plan.months:
            await self._upsert_plan_row(
                company_id,
                m.period,
                m.dev_count,
                m.sales_count,
                m.marketing_count,
                m.fot,
                m.social_payments,
            )
        return plan

    async def _upsert_plan_row(
        self,
        company_id: UUID,
        period: date,
        dev: int,
        sales: int,
        marketing: int,
        fot: float,
        social: float,
    ) -> None:
        result = await self.db.execute(
            select(HiringPlan).where(
                HiringPlan.company_id == company_id,
                HiringPlan.period == period,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = HiringPlan(company_id=company_id, period=period)
            self.db.add(row)
        row.dev_count = dev
        row.sales_count = sales
        row.marketing_count = marketing
        row.total_fot = fot
        row.social_payments = social
        await self.db.flush()
