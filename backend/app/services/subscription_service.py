from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.models.subscription import Subscription
from app.models.ai_cache import AICache
from app.core.plans import PLANS, normalize_plan, ai_reports_limit
from app.schemas.subscription import PlanResponse
from datetime import datetime, timezone
from uuid import UUID

class SubscriptionService:
    """Сервис управления подписками и лимитами (источник тарифов — core/plans.py)."""
    
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def get_plans() -> list[PlanResponse]:
        """Доступные тарифные планы (TZ v5.0, раздел 17)."""
        return [PlanResponse(**p) for p in PLANS]

    async def get_plan_id(self, user_id: UUID) -> str:
        """Нормализованный идентификатор тарифа пользователя (дефолт — starter)."""
        result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        return normalize_plan(sub.plan if sub else None)
    
    async def get_user_subscription(self, user_id: UUID) -> dict:
        """Получить информацию о подписке пользователя.

        Лимит AI-запросов берётся из тарифа (core/plans.py), а не из
        устаревшего поля daily_limit: None означает безлимит.
        """
        result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Подписка не найдена"
            )
        
        plan_id = normalize_plan(sub.plan)
        today = datetime.now(timezone.utc).date()
        count_result = await self.db.execute(
            select(func.count(AICache.id)).where(
                AICache.user_id == user_id,
                AICache.created_at >= today,
            )
        )
        used_today = count_result.scalar() or 0
        
        return {
            "plan": plan_id,
            "status": sub.status,
            "daily_limit": ai_reports_limit(plan_id),
            "used_today": used_today,
            "start_date": sub.start_date,
            "end_date": sub.end_date
        }
    
    async def check_limit(self, user_id: UUID) -> bool:
        """Проверяет, не превышен ли дневной лимит AI-запросов."""
        sub_info = await self.get_user_subscription(user_id)
        
        if sub_info["status"] != "active":
            return False
        
        limit = sub_info["daily_limit"]
        if limit is None:
            return True
        
        return sub_info["used_today"] < limit
