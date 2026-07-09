from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException, status
from app.models.user import User
from app.models.subscription import Subscription
from app.models.ai_cache import AICache
from datetime import datetime, timedelta, timezone
from uuid import UUID

class SubscriptionService:
    """Сервис управления подписками."""
    
    PLAN_LIMITS = {
        "free": 1,
        "pro": 10,
        "business": 50
    }
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_user_subscription(self, user_id: UUID) -> dict:
        """Получить информацию о подписке пользователя."""
        result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Подписка не найдена"
            )
        
        today = datetime.now(timezone.utc).date()
        count_result = await self.db.execute(
            select(func.count(AICache.id)).where(
                AICache.user_id == user_id,
                AICache.created_at >= today,
            )
        )
        used_today = count_result.scalar() or 0
        
        return {
            "plan": sub.plan,
            "status": sub.status,
            "daily_limit": sub.daily_limit,
            "used_today": used_today,
            "start_date": sub.start_date,
            "end_date": sub.end_date
        }
    
    async def check_limit(self, user_id: UUID) -> bool:
        """Проверяет, не превышен ли лимит запросов."""
        sub_info = await self.get_user_subscription(user_id)
        
        if sub_info["status"] != "active":
            return False
        
        return sub_info["used_today"] < sub_info["daily_limit"]
    
    async def update_plan(self, user_id: UUID, plan: str) -> dict:
        """Обновить тарифный план."""
        if plan not in self.PLAN_LIMITS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Неверный план. Доступны: {list(self.PLAN_LIMITS.keys())}"
            )
        
        result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        
        if not sub:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Подписка не найдена"
            )
        
        sub.plan = plan
        sub.daily_limit = self.PLAN_LIMITS[plan]
        sub.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        
        await self.db.flush()
        
        return {
            "plan": plan,
            "daily_limit": self.PLAN_LIMITS[plan],
            "updated": sub.updated_at
        }
