from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.subscription import Subscription
from app.models.ai_cache import AICache
from app.models.organization import Organization
from app.models.company import Company
from app.models.metric import Metric
from app.core.security import hash_password
from app.schemas.ai_metrics import MetricsRequest
from app.services.ai_service import AIService
from app.core.time import utcnow
from datetime import timedelta, date
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
    # metriki.md seed fields (consumed by Metric constructors below, not by MetricsRequest)
    "new_units": 45,
    "revenue": 48700.0,
    "marketing_spend": 15750.0,
    "retention_rate": 0.965,
}


def _metric_payload(
    *, new_units: int, arpu: float, revenue: float,
    marketing_spend: float, retention_rate: float,
) -> dict:
    """Metric kwargs with churn/ltv/cac derived (mirrors MetricService._derived)."""
    churn = round(1 - retention_rate, 4)
    ltv = round(arpu / churn, 2) if churn > 0 else round(arpu * 12, 2)
    cac = round(marketing_spend / new_units, 2) if new_units > 0 else 0.0
    return {
        "new_units": new_units,
        "arpu": arpu,
        "revenue": revenue,
        "marketing_spend": marketing_spend,
        "retention_rate": retention_rate,
        "churn": churn,
        "ltv": ltv,
        "cac": cac,
    }


async def seed_demo_account(db: AsyncSession) -> dict:
    existing = await db.execute(select(User).where(User.email == settings.DEMO_ACCOUNT_EMAIL))
    user = existing.scalar_one_or_none()

    if not user:
        user = User(
            email=settings.DEMO_ACCOUNT_EMAIL,
            password_hash=hash_password(settings.DEMO_ACCOUNT_PASSWORD.get_secret_value()),
            full_name="Demo Investor",
            company_name="SaaSify Inc.",
        )
        db.add(user)
        await db.flush()

        subscription = Subscription(
            user_id=user.id,
            plan="starter",
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
            **_metric_payload(
                new_units=DEMO_METRICS["new_units"],
                arpu=DEMO_METRICS["arpu"],
                revenue=DEMO_METRICS["revenue"],
                marketing_spend=DEMO_METRICS["marketing_spend"],
                retention_rate=DEMO_METRICS["retention_rate"],
            ),
        ))
        db.add(Metric(
            company_id=company.id, period=today, type="plan",
            **_metric_payload(
                new_units=50, arpu=890.0, revenue=52000.0,
                marketing_spend=16000.0, retention_rate=0.97,
            ),
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
            expires_at=utcnow() + timedelta(hours=24),
        )
        db.add(cache_entry)
        await db.flush()

    return {
        "email": settings.DEMO_ACCOUNT_EMAIL,
        "user_id": str(user.id),
    }
