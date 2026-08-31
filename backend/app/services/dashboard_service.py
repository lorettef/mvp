from typing import Optional
from uuid import UUID

from sqlalchemy import select, func
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

        items: list[CompanyStatusItem] = []
        counts = {"on_track": 0, "behind": 0, "no_plan": 0, "no_data": 0}

        revenue_values: list[float] = []
        cac_values: list[float] = []
        ltv_values: list[float] = []
        churn_values: list[float] = []

        for company in companies:
            fact = await self._latest_metric(company.id, "fact")
            plan = await self._latest_metric(company.id, "plan")

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
                    task_progress=await self._task_progress(company.id),
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

    async def _latest_metric(self, company_id: UUID, type_: str) -> Optional[Metric]:
        """Последняя метрика компании заданного типа (plan/fact)."""
        result = await self.db.execute(
            select(Metric)
            .where(Metric.company_id == company_id, Metric.type == type_)
            .order_by(Metric.period.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _task_progress(self, company_id: UUID) -> Optional[int]:
        """Процент выполненных задач компании (None, если задач нет)."""
        total_result = await self.db.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.company_id == company_id)
        )
        total = total_result.scalar_one()
        if total == 0:
            return None
        done_result = await self.db.execute(
            select(func.count())
            .select_from(Task)
            .where(Task.company_id == company_id, Task.status == "done")
        )
        done = done_result.scalar_one()
        return round(done / total * 100)

    @staticmethod
    def _mean(values: list[float]) -> Optional[float]:
        """Среднее арифметическое; None, если значений нет."""
        if not values:
            return None
        return sum(values) / len(values)