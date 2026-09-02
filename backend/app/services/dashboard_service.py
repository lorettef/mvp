from typing import Optional
from uuid import UUID

from sqlalchemy import and_, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.metric import Metric
from app.models.task import Task
from app.schemas.dashboard import CompanyStatusItem, DashboardResponse


class DashboardService:
    """Сервис агрегированных метрик портфеля компаний."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, organization_id: UUID) -> DashboardResponse:
        """Агрегированные показатели по всем компаниям организации."""
        result = await self.db.execute(
            select(Company)
            .where(Company.organization_id == organization_id)
            .order_by(Company.name)
        )
        companies = list(result.scalars().all())
        company_ids = [company.id for company in companies]

        # Latest fact + plan metric per company in one batched query (SQLite-safe,
        # no DISTINCT ON): join against max(period) per (company_id, type).
        latest_periods = (
            select(Metric.company_id, Metric.type, func.max(Metric.period).label("max_period"))
            .where(Metric.company_id.in_(company_ids))
            .group_by(Metric.company_id, Metric.type)
            .subquery()
        )
        metrics_rows = await self.db.execute(
            select(Metric).join(
                latest_periods,
                and_(
                    Metric.company_id == latest_periods.c.company_id,
                    Metric.type == latest_periods.c.type,
                    Metric.period == latest_periods.c.max_period,
                ),
            )
        )
        latest: dict[tuple[UUID, str], Metric] = {
            (metric.company_id, metric.type): metric
            for metric in metrics_rows.scalars().all()
        }

        progress_rows = await self.db.execute(
            select(
                Task.company_id,
                func.count().label("total"),
                func.count().filter(Task.status == "done").label("done"),
            )
            .where(Task.company_id.in_(company_ids))
            .group_by(Task.company_id)
        )
        progress: dict[UUID, Optional[int]] = {
            row.company_id: None if row.total == 0 else round(row.done / row.total * 100)
            for row in progress_rows.all()
        }

        items: list[CompanyStatusItem] = []
        counts = {"on_track": 0, "behind": 0, "no_plan": 0, "no_data": 0}

        revenue_values: list[float] = []
        cac_values: list[float] = []
        ltv_values: list[float] = []
        churn_values: list[float] = []

        for company in companies:
            fact = latest.get((company.id, "fact"))
            plan = latest.get((company.id, "plan"))

            if fact is None:
                status = "no_data"
                latest_revenue = None
                latest_plan_revenue = None
            else:
                latest_revenue = float(fact.revenue)
                revenue_values.append(latest_revenue)
                cac_values.append(float(fact.cac))
                ltv_values.append(float(fact.ltv))
                churn_values.append(float(fact.churn))

                if plan is None:
                    status = "no_plan"
                    latest_plan_revenue = None
                else:
                    latest_plan_revenue = float(plan.revenue)
                    if latest_revenue >= latest_plan_revenue:
                        status = "on_track"
                    else:
                        status = "behind"

            counts[status] += 1

            items.append(
                CompanyStatusItem(
                    id=company.id,
                    name=company.name,
                    industry=company.industry,
                    geography=company.geography,
                    status=status,
                    latest_revenue=latest_revenue,
                    latest_plan_revenue=latest_plan_revenue,
                    task_progress=progress.get(company.id),
                )
            )

        return DashboardResponse(
            total_companies=len(companies),
            avg_revenue=self._mean(revenue_values),
            avg_cac=self._mean(cac_values),
            avg_ltv=self._mean(ltv_values),
            avg_churn=self._mean(churn_values),
            on_track=counts["on_track"],
            behind=counts["behind"],
            no_plan=counts["no_plan"],
            no_data=counts["no_data"],
            companies=items,
        )

    @staticmethod
    def _mean(values: list[float]) -> Optional[float]:
        """Среднее арифметическое; None, если значений нет."""
        if not values:
            return None
        return sum(values) / len(values)