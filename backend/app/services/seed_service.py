from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.subscription import Subscription
from app.models.ai_cache import AICache
from app.core.security import hash_password
from app.schemas.metrics import MetricsRequest
from app.services.ai_service import AIService
from datetime import datetime, timezone, timedelta
import json
import hashlib
from uuid import UUID

from app.core.config import settings
DEMO_METRICS = {
    "mrr": 48700.0,
    "cac": 350.0,
    "ltv": 4800.0,
    "churn": 0.035,
    "arpu": 890.0,
    "runway_months": 14.0,
    "stage": "seed",
    "active_users": 62,
}


async def seed_demo_account(db: AsyncSession) -> dict:
    existing = await db.execute(select(User).where(User.email == settings.DEMO_ACCOUNT_EMAIL))
    user = existing.scalar_one_or_none()

    if not user:
        user = User(
            email=settings.DEMO_ACCOUNT_EMAIL,
            password_hash=hash_password(settings.DEMO_ACCOUNT_PASSWORD),
            full_name="Demo Investor",
            company_name="SaaSify Inc.",
        )
        db.add(user)
        await db.flush()

        subscription = Subscription(
            user_id=user.id,
            plan="free",
            daily_limit=3,
        )
        db.add(subscription)

        metrics = MetricsRequest(**DEMO_METRICS)
        ai_service = AIService(db)
        data = {
            "mrr": metrics.mrr,
            "cac": metrics.cac,
            "ltv": metrics.ltv,
            "churn": metrics.churn,
            "arpu": metrics.arpu,
            "runway": metrics.runway_months,
            "stage": metrics.stage,
        }
        metrics_hash = hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

        recommendations = ai_service._generate_demo_recommendations(metrics)
        cache_entry = AICache(
            user_id=user.id,
            metrics_hash=metrics_hash,
            response=json.dumps(recommendations.model_dump()),
            expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24),
        )
        db.add(cache_entry)
        await db.flush()
    else:
        subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        sub = subscription_result.scalar_one_or_none()
        if sub and sub.daily_limit < 3:
            sub.daily_limit = 3
            await db.flush()

    return {
        "email": settings.DEMO_ACCOUNT_EMAIL,
        "password": settings.DEMO_ACCOUNT_PASSWORD,
    }
