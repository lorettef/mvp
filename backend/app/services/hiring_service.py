from datetime import date
from math import ceil
from typing import Dict, List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import today
from app.models.company import Company
from app.models.hiring_plan_row import HiringPlanRow
from app.models.hiring_settings import HiringSettings
from app.models.hiring_team import HiringTeam
from app.schemas.hiring import (
    DEFAULT_NDFL_RATE,
    DEFAULT_INSURANCE_RATE,
    DEFAULT_INJURY_RATE,
    HiringApproveUpsert,
    HiringMonthPlan,
    HiringPlanResponse,
    HiringRolePlan,
    HiringSettingsResponse,
    HiringSettingsUpsert,
    HiringTeamRow,
    HiringTeamUpsert,
)
from app.services.common import latest_metrics

# Каталог ролей (TZ, раздел 19). Порядок = порядок отображения.
ROLE_GROUPS: Dict[str, str] = {
    "backend": "engineering",
    "frontend": "engineering",
    "qa": "engineering",
    "devops": "engineering",
    "sales_manager": "sales",
    "sdr": "sales",
    "support": "customer",
    "customer_success": "customer",
    "marketing": "marketing",
    "management": "management",
}

ROLE_LABELS: Dict[str, str] = {
    "backend": "Backend",
    "frontend": "Frontend",
    "qa": "QA",
    "devops": "DevOps",
    "sales_manager": "Sales Manager",
    "sdr": "SDR",
    "support": "Support",
    "customer_success": "Customer Success",
    "marketing": "Marketing",
    "management": "Management / Operations",
}

ALL_ROLES = list(ROLE_GROUPS.keys())

# Capacity-предположения (TZ, раздел 21): документированные domain-константы.
SALES_CAPACITY = 50.0         # новых клиентов на 1 Sales Manager в месяц
SDR_CAPACITY = 120.0          # новых клиентов (new_units) на 1 SDR в месяц
SUPPORT_CAPACITY = 200.0      # активных клиентов на 1 Support
SUCCESS_CAPACITY = 100.0      # активных клиентов на 1 Customer Success
MARKETING_BASELINE = 1.0      # минимальный состав маркетинга
MARKETING_CAPACITY = 300.0    # новых клиентов на 1 маркетолога
MANAGEMENT_BASELINE = 1.0     # минимальный менеджмент
ENGINEERING_BASELINE = 2.0    # минимальный инженерный состав
ENGINEERING_REVENUE_PER_HEAD = 500000.0  # ₽/мес выручки на 1 инженера
ENGINEERING_MIX = {"backend": 0.40, "frontend": 0.30, "qa": 0.15, "devops": 0.15}

DEFAULT_SALARY = 150000.0
MONTHLY_GROWTH = 0.05  # ежемесячный рост драйверов прогноза
HORIZON_MONTHS = 12


def _add_months(period: date, n: int) -> date:
    zero = period.month - 1 + n
    year = period.year + zero // 12
    month = zero % 12 + 1
    return date(year, month, 1)


class HiringService:
    """Role-based прогноз найма: драйверы → required → recommended/approved."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _sum_rate(*rates: float) -> float:
        return round(sum(rates), 4)

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
            employer_rate=self._sum_rate(insurance, injury),
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
            employer_rate=self._sum_rate(data.insurance_rate, data.injury_rate),
        )

    async def list_team(self, company_id: UUID) -> List[HiringTeamRow]:
        result = await self.db.execute(
            select(HiringTeam).where(HiringTeam.company_id == company_id)
        )
        rows = list(result.scalars().all())
        return [
            HiringTeamRow(
                role_key=r.role_key,
                headcount=r.headcount,
                salary=float(r.salary),
            )
            for r in rows
        ]

    async def upsert_team(self, company_id: UUID, data: HiringTeamUpsert) -> HiringTeamRow:
        result = await self.db.execute(
            select(HiringTeam).where(
                HiringTeam.company_id == company_id,
                HiringTeam.role_key == data.role_key,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = HiringTeam(company_id=company_id, role_key=data.role_key)
            self.db.add(row)
        row.headcount = data.headcount
        row.salary = data.salary
        await self.db.flush()
        await self.db.refresh(row)
        return HiringTeamRow(
            role_key=row.role_key,
            headcount=row.headcount,
            salary=float(row.salary),
        )

    async def _load_team(self, company_id: UUID) -> Dict[str, Tuple[int, float]]:
        result = await self.db.execute(
            select(HiringTeam).where(HiringTeam.company_id == company_id)
        )
        return {
            r.role_key: (r.headcount, float(r.salary))
            for r in result.scalars().all()
        }

    async def _load_approved(
        self, company_id: UUID, start: date
    ) -> Dict[Tuple[date, str], int]:
        result = await self.db.execute(
            select(HiringPlanRow).where(HiringPlanRow.company_id == company_id)
        )
        return {
            (r.period, r.role_key): r.approved_hires
            for r in result.scalars().all()
        }

    @staticmethod
    def _required_headcount(role_key: str, nu: float, au: float, revenue: float) -> int:
        if role_key == "sales_manager":
            return max(0, ceil(nu / SALES_CAPACITY))
        if role_key == "sdr":
            return max(0, ceil(nu / SDR_CAPACITY))
        if role_key == "support":
            return max(0, ceil(au / SUPPORT_CAPACITY))
        if role_key == "customer_success":
            return max(0, ceil(au / SUCCESS_CAPACITY))
        if role_key == "marketing":
            return max(MARKETING_BASELINE, ceil(nu / MARKETING_CAPACITY))
        if role_key == "management":
            return MANAGEMENT_BASELINE
        eng_total = max(
            ENGINEERING_BASELINE, ceil(revenue / ENGINEERING_REVENUE_PER_HEAD)
        )
        return max(0, round(eng_total * ENGINEERING_MIX[role_key]))

    async def build_plan(
        self, company_id: UUID, forecast_start: Optional[date] = None
    ) -> HiringPlanResponse:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        settings = await self.get_settings(company_id)
        team = await self._load_team(company_id)
        rows = await latest_metrics(
            self.db, company_id, prefer="plan", fallback=True, limit=1
        )
        metric = rows[0] if rows else None
        revenue = float(metric.revenue) if metric and metric.revenue is not None else None

        start = forecast_start or _add_months(today().replace(day=1), 1)
        approved_map = await self._load_approved(company_id, start)

        team_rows = [
            HiringTeamRow(role_key=k, headcount=v[0], salary=v[1])
            for k, v in team.items()
        ]

        if revenue is None:
            return HiringPlanResponse(
                company_id=company_id,
                forecast_start=start,
                settings=settings,
                team=team_rows,
                months=[],
                final_headcount=0,
                summary=(
                    "Метрики выручки не найдены. Добавьте метрики (План или Факт), "
                    "чтобы рассчитать прогноз найма."
                ),
            )

        nu = float(metric.new_units or 0) if metric else 0.0
        au = float(metric.active_units or nu) if metric else 0.0

        months: List[HiringMonthPlan] = []
        cumulative_approved: Dict[str, int] = {role: 0 for role in ALL_ROLES}
        for m in range(HORIZON_MONTHS):
            period = _add_months(start, m)
            growth = (1 + MONTHLY_GROWTH) ** (m + 1)
            m_nu = nu * growth
            m_au = au * growth
            m_revenue = revenue * growth

            roles: List[HiringRolePlan] = []
            for role_key in ALL_ROLES:
                current, salary = team.get(role_key, (0, DEFAULT_SALARY))
                required = self._required_headcount(role_key, m_nu, m_au, m_revenue)
                recommended = max(0, required - current)
                approved = approved_map.get((period, role_key), 0)
                cumulative_approved[role_key] += approved
                employer_cost = round(salary * settings.employer_rate, 2)
                roles.append(
                    HiringRolePlan(
                        role_key=role_key,
                        label=ROLE_LABELS[role_key],
                        group=ROLE_GROUPS[role_key],
                        required_headcount=required,
                        recommended_hires=recommended,
                        approved_hires=approved,
                        salary=salary,
                        employer_cost=employer_cost,
                    )
                )

            total_required = sum(r.required_headcount for r in roles)
            total_approved = sum(r.approved_hires for r in roles)
            payroll = round(
                sum(
                    (team.get(r.role_key, (0, r.salary))[0] + cumulative_approved[r.role_key])
                    * (r.salary + r.employer_cost)
                    for r in roles
                ),
                2,
            )
            hires_payroll = round(
                sum(
                    cumulative_approved[r.role_key] * (r.salary + r.employer_cost)
                    for r in roles
                ),
                2,
            )
            months.append(
                HiringMonthPlan(
                    period=period,
                    roles=roles,
                    total_required=total_required,
                    total_approved=total_approved,
                    payroll=payroll,
                    hires_payroll=hires_payroll,
                )
            )

        final = months[-1]
        summary = (
            f"Целевой штат через {HORIZON_MONTHS} мес. — {final.total_required} чел. "
            f"Одобрено к найму: {final.total_approved} чел. "
            f"ФОТ (approved) ≈ {final.payroll:,.0f} ₽/мес."
        )

        return HiringPlanResponse(
            company_id=company_id,
            forecast_start=start,
            settings=settings,
            team=team_rows,
            months=months,
            final_headcount=final.total_required,
            summary=summary,
        )

    async def generate_plan(
        self, company_id: UUID, forecast_start: Optional[date] = None
    ) -> HiringPlanResponse:
        """Рассчитать и сохранить рекомендацию (approved по умолчанию = recommended)."""
        plan = await self.build_plan(company_id, forecast_start)
        for month in plan.months:
            for role in month.roles:
                await self._upsert_plan_row(
                    company_id,
                    month.period,
                    role.role_key,
                    role.required_headcount,
                    role.recommended_hires,
                    role.approved_hires or role.recommended_hires,
                )
        return await self.build_plan(company_id, forecast_start)

    async def approve_plan(
        self, company_id: UUID, data: HiringApproveUpsert
    ) -> HiringPlanResponse:
        """Сохранить утверждённые наймы (approved_hires) пользователем."""
        for item in data.items:
            result = await self.db.execute(
                select(HiringPlanRow).where(
                    HiringPlanRow.company_id == company_id,
                    HiringPlanRow.period == item.period,
                    HiringPlanRow.role_key == item.role_key,
                )
            )
            row = result.scalar_one_or_none()
            if row is None:
                row = HiringPlanRow(
                    company_id=company_id,
                    period=item.period,
                    role_key=item.role_key,
                    required_headcount=0,
                    recommended_hires=0,
                )
                self.db.add(row)
            row.approved_hires = item.approved_hires
            await self.db.flush()
        return await self.build_plan(company_id)

    async def _upsert_plan_row(
        self,
        company_id: UUID,
        period: date,
        role_key: str,
        required: int,
        recommended: int,
        approved: int,
    ) -> None:
        result = await self.db.execute(
            select(HiringPlanRow).where(
                HiringPlanRow.company_id == company_id,
                HiringPlanRow.period == period,
                HiringPlanRow.role_key == role_key,
            )
        )
        row = result.scalar_one_or_none()
        if row is None:
            row = HiringPlanRow(company_id=company_id, period=period, role_key=role_key)
            self.db.add(row)
        row.required_headcount = required
        row.recommended_hires = recommended
        row.approved_hires = approved
        await self.db.flush()
