from typing import List, Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import metric_catalog
from app.models.company import Company
from app.models.task import Task
from app.schemas.recommendations import RecommendationAction
from app.schemas.task import PRIORITIES, TaskResponse
from app.services.ai_service import AIService
from app.services.common import latest_metrics
from app.services.unit_economics_service import UnitEconomicsService

DEFAULT_RUNWAY_MONTHS = 12.0
DEFAULT_STAGE = "seed"


class RecommendationTaskService:
    """AI-рекомендации по компании с авто-конвертацией в задачи и дедупликацией."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate_and_convert(self, company_id: UUID, user_id) -> dict:
        company = await self.db.get(Company, company_id)
        if company is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )

        rows = await latest_metrics(
            self.db, company_id, prefer="fact", fallback=True, limit=1
        )
        if not rows:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Недостаточно данных: добавьте метрики, чтобы получить AI-рекомендации.",
            )

        context = metric_catalog.describe_company(
            company.industry,
            company.business_model,
            company.geography,
            company.selected_metrics,
        )
        metrics_dict = await self._build_metrics_dict(company_id, rows[0])

        ai = AIService(self.db)
        response = await ai.get_company_recommendations(metrics_dict, str(user_id), context)

        tasks: List[TaskResponse] = []
        created = 0
        updated = 0
        for rec in response.recommendations:
            priority = self._normalize_priority(rec.priority)
            existing = await self._find_duplicate(company_id, rec)
            if existing is not None:
                existing.title = rec.title
                existing.description = rec.description
                existing.priority = priority
                existing.metric = rec.metric
                updated += 1
            else:
                existing = Task(
                    company_id=company_id,
                    title=rec.title,
                    description=rec.description,
                    stage="metrics",
                    status="pending",
                    source="ai_recommendation",
                    metric=rec.metric,
                    priority=priority,
                )
                self.db.add(existing)
                created += 1
            await self.db.flush()
            await self.db.refresh(existing)
            tasks.append(TaskResponse.model_validate(existing))

        return {
            "summary": response.summary,
            "provider": response.provider,
            "tasks": tasks,
            "created_count": created,
            "updated_count": updated,
        }

    async def _find_duplicate(self, company_id: UUID, rec: RecommendationAction) -> Optional[Task]:
        query = select(Task).where(
            Task.company_id == company_id,
            Task.source == "ai_recommendation",
            Task.status != "done",
        )
        if rec.metric:
            query = query.where(Task.metric == rec.metric)
        else:
            normalized = rec.title.strip().lower()
            query = query.where(func.lower(func.trim(Task.title)) == normalized)
        result = await self.db.execute(query)
        return result.scalars().first()

    @staticmethod
    def _normalize_priority(value: Optional[str]) -> Optional[str]:
        return value if value in PRIORITIES else None

    async def _build_metrics_dict(self, company_id: UUID, metric_row) -> dict:
        unit = await UnitEconomicsService(self.db).get_unit_economics(company_id)
        runway = unit.runway_months
        if not runway or runway <= 0:
            runway = DEFAULT_RUNWAY_MONTHS

        active_users = metric_row.active_units
        if active_users is None or active_users <= 0:
            active_users = None

        return {
            "mrr": self._positive(metric_row.revenue),
            "cac": self._positive(metric_row.cac),
            "ltv": self._positive(metric_row.ltv),
            "churn": self._clamp01(metric_row.churn),
            "arpu": self._positive(metric_row.arpu),
            "runway_months": runway,
            "stage": DEFAULT_STAGE,
            "active_users": active_users,
        }

    @staticmethod
    def _positive(value, default: float = 1.0) -> float:
        try:
            v = float(value)
        except (TypeError, ValueError):
            return default
        return v if v > 0 else default

    @staticmethod
    def _clamp01(value) -> float:
        try:
            v = float(value)
        except (TypeError, ValueError):
            return 0.0
        return max(0.0, min(1.0, v))
