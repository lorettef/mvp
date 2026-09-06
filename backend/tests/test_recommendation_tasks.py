from datetime import date

from .conftest import auth_headers
from app.core.config import settings
from app.models.metric import Metric
from app.models.subscription import Subscription


async def _seed_metrics(db, company_id):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=50000,
            arpu=500,
            cac=1000,
            ltv=2000,
            churn=0.1,
            marketing_spend=10000,
            new_units=50,
            retention_rate=0.9,
        )
    )
    await db.flush()


async def _seed_subscription(db, user):
    db.add(Subscription(user_id=user.id, plan="pro", status="active", daily_limit=10))
    await db.flush()


def _url(company_id):
    return f"/api/v1/companies/{company_id}/recommendations"


async def test_recommendations_convert_and_dedup(
    client, seeded_company, seeded_admin, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_metrics(db_session, seeded_company.id)
    await _seed_subscription(db_session, seeded_admin)

    first = await client.post(_url(seeded_company.id), headers=auth_headers(seeded_admin))
    assert first.status_code == 200
    first_body = first.json()
    assert first_body["created_count"] > 0
    assert first_body["updated_count"] == 0

    second = await client.post(_url(seeded_company.id), headers=auth_headers(seeded_admin))
    assert second.status_code == 200
    second_body = second.json()
    assert second_body["created_count"] == 0
    assert second_body["updated_count"] > 0
    assert len(second_body["tasks"]) == len(first_body["tasks"])


async def test_recommendation_tasks_fields(
    client, seeded_company, seeded_admin, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_metrics(db_session, seeded_company.id)
    await _seed_subscription(db_session, seeded_admin)

    res = await client.post(_url(seeded_company.id), headers=auth_headers(seeded_admin))
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "demo"
    assert body["summary"]
    tasks = body["tasks"]
    assert len(tasks) > 0
    for t in tasks:
        assert t["source"] == "ai_recommendation"
        assert t["stage"] == "metrics"
        assert t["status"] == "pending"
    assert any(t["metric"] for t in tasks)
    assert any(t["priority"] in ("high", "medium", "low") for t in tasks)


async def test_recommendations_no_metrics_422(
    client, seeded_company, seeded_admin, db_session, monkeypatch
):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_subscription(db_session, seeded_admin)

    res = await client.post(_url(seeded_company.id), headers=auth_headers(seeded_admin))
    assert res.status_code == 422
