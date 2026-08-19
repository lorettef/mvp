from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.subscription import Subscription
from app.models.ai_cache import AICache
from app.models.organization import Organization
from app.models.company import Company
from app.models.metric import Metric
from app.core.security import hash_password
from app.schemas.metrics import MetricsRequest
from app.services.ai_service import AIService
from datetime import datetime, timezone, timedelta, date
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

        organization = Organization(name="Demo Accelerator")
        db.add(organization)
        await db.flush()

        company = Company(organization_id=organization.id, name="SaaSify Inc.")
        db.add(company)
        await db.flush()

        user.role = "admin"
        user.organization_id = organization.id
        user.company_id = company.id

        today = date.today().replace(day=1)
        db.add(Metric(
            company_id=company.id, period=today, type="fact",
            mrr=DEMO_METRICS["mrr"], cac=DEMO_METRICS["cac"], ltv=DEMO_METRICS["ltv"],
            churn=DEMO_METRICS["churn"], arpu=DEMO_METRICS["arpu"],
            runway_months=DEMO_METRICS["runway_months"], stage=DEMO_METRICS["stage"],
        ))
        db.add(Metric(
            company_id=company.id, period=today, type="plan",
            mrr=52000.0, cac=320.0, ltv=5000.0, churn=0.03,
        ))

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
        "user_id": str(user.id),
    }
