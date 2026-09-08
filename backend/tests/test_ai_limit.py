"""AI daily limit enforcement (SEC-001 fix).

Проверяет, что лимит AI-запросов списывается атомарно из явного счётчика
subscriptions.used_today/used_date (а не из подсчёта строк ai_cache) и
корректно сбрасывается с началом нового дня.
"""

from datetime import date

from sqlalchemy import select

from app.models.subscription import Subscription
from app.services.subscription_service import SubscriptionService

from .conftest import make_user, auth_headers


async def _add_sub(db, user, plan="starter"):
    db.add(Subscription(user_id=user.id, plan=plan, status="active"))
    await db.flush()


async def test_try_consume_ai_limit_respects_starter_limit(db_session):
    user = await make_user(db_session, "limit@test.ru", "admin")
    await _add_sub(db_session, user, "starter")  # ai_reports_limit = 1

    svc = SubscriptionService(db_session)
    assert await svc.try_consume_ai_limit(user.id) is True
    assert await svc.try_consume_ai_limit(user.id) is False


async def test_try_consume_ai_limit_unlimited_plan(db_session):
    user = await make_user(db_session, "unlim@test.ru", "admin")
    await _add_sub(db_session, user, "business")  # ai_reports_limit = None

    svc = SubscriptionService(db_session)
    assert await svc.try_consume_ai_limit(user.id) is True
    assert await svc.try_consume_ai_limit(user.id) is True


async def test_used_today_is_counter_based(db_session):
    user = await make_user(db_session, "used@test.ru", "admin")
    await _add_sub(db_session, user, "pro")  # limit 5

    svc = SubscriptionService(db_session)
    await svc.try_consume_ai_limit(user.id)

    info = await svc.get_user_subscription(user.id)
    assert info["used_today"] == 1
    assert info["daily_limit"] == 5


async def test_daily_reset_restores_limit(db_session):
    user = await make_user(db_session, "reset@test.ru", "admin")
    await _add_sub(db_session, user, "starter")

    svc = SubscriptionService(db_session)
    assert await svc.try_consume_ai_limit(user.id) is True
    assert await svc.try_consume_ai_limit(user.id) is False

    # Наступает новый день — счётчик сбрасывается, лимит снова доступен.
    sub = (
        await db_session.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
    ).scalar_one()
    sub.used_date = date(2000, 1, 1)
    await db_session.flush()

    assert await svc.try_consume_ai_limit(user.id) is True


async def test_ai_limit_enforced_on_forecast_endpoint(client, db_session, seeded_admin):
    """starter (limit=1): первый прогноз 200, второй 429."""
    await _add_sub(db_session, seeded_admin, "starter")
    payload = {"history": [1, 2, 3, 4], "months": 6, "method": "linear"}
    headers = auth_headers(seeded_admin)

    r1 = await client.post("/api/v1/forecast/predict", json=payload, headers=headers)
    assert r1.status_code == 200, r1.text

    r2 = await client.post("/api/v1/forecast/predict", json=payload, headers=headers)
    assert r2.status_code == 429, r2.text
