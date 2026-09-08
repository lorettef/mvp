from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, case, or_
from fastapi import HTTPException, status
from app.models.subscription import Subscription
from app.core.plans import PLANS, normalize_plan, ai_reports_limit, DEFAULT_PLAN
from app.core.roles import ROLE_ADMIN
from app.models.user import User
from app.schemas.subscription import PlanResponse
from datetime import datetime, timezone, date
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

    async def get_org_plan_id(self, organization_id: UUID) -> str:
        """Идентификатор тарифа организации (по её администратору-владельцу)."""
        result = await self.db.execute(
            select(User).where(
                User.organization_id == organization_id,
                User.role == ROLE_ADMIN,
            )
        )
        owner = result.scalars().first()
        if not owner:
            return DEFAULT_PLAN
        return await self.get_plan_id(owner.id)
    
    async def get_user_subscription(self, user_id: UUID) -> dict:
        """Получить информацию о подписке пользователя.

        Лимит AI-запросов берётся из тарифа (core/plans.py), а не из
        устаревшего поля daily_limit. used_today берётся из явного счётчика
        subscriptions.used_today (сбрасывается по used_date), а НЕ из подсчёта
        строк ai_cache — счётчик независим от работоспособности кэша.
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
        used_today = sub.used_today if sub.used_date == today else 0
        
        return {
            "plan": plan_id,
            "status": sub.status,
            "daily_limit": ai_reports_limit(plan_id),
            "used_today": used_today,
            "start_date": sub.start_date,
            "end_date": sub.end_date
        }
    
    async def try_consume_ai_limit(self, user_id: UUID) -> bool:
        """Атомарно списывает один AI-запрос, если дневной лимит не исчерпан.

        Возвращает True, если запрос разрешён (счётчик увеличен), иначе False.

        Один атомарный UPDATE с условием гарантирует, что при лимите N не более
        N параллельных запросов пройдут проверку (защита от race condition):
        строку блокирует/пересчитывает БД, а не два независимых SELECT.
        """
        result = await self.db.execute(
            select(Subscription).where(Subscription.user_id == user_id)
        )
        sub = result.scalar_one_or_none()
        if not sub or sub.status != "active":
            return False

        limit = ai_reports_limit(normalize_plan(sub.plan))
        if limit is None:
            return True

        today = datetime.now(timezone.utc).date()
        is_new_day = Subscription.used_date != today

        update_result = await self.db.execute(
            update(Subscription)
            .where(
                Subscription.user_id == user_id,
                or_(is_new_day, Subscription.used_today < limit),
            )
            .values(
                used_today=case((is_new_day, 1), else_=Subscription.used_today + 1),
                used_date=today,
            )
        )
        return update_result.rowcount == 1
