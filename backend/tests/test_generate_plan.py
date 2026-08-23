from datetime import date

import pytest

from .conftest import auth_headers
from app.core.config import settings
from app.models.metric import Metric
from app.models.subscription import Subscription


async def _seed_facts(db, company_id):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 1, 1),
            type="fact",
            mrr=100000,
            cac=5000,
            ltv=20000,
            churn=0.05,
        )
    )
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            mrr=120000,
            cac=4500,
            ltv=22000,
            churn=0.04,
        )
    )
    await db.flush()


async def _seed_subscription(db, user):
    db.add(
        Subscription(
            user_id=user.id,
            plan="pro",
            status="active",
            daily_limit=10,
        )
    )
    await db.flush()


async def test_generate_plan_demo(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_facts(db_session, seeded_company.id)
    await _seed_subscription(db_session, seeded_admin)

    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/generate-plan",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "demo"
    assert body["company_id"] == str(seeded_company.id)
    assert len(body["metrics"]) == 6
    # первый месяц плана — март 2026 (после последнего факта 2026-02)
    assert body["metrics"][0]["period"].startswith("2026-03")
    # MRR растёт на 5% в месяц: 120000 * 1.05
    assert body["metrics"][0]["mrr"] == pytest.approx(126000.0)


async def test_generate_plan_persists(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_facts(db_session, seeded_company.id)
    await _seed_subscription(db_session, seeded_admin)

    await client.post(
        f"/api/v1/companies/{seeded_company.id}/generate-plan",
        headers=auth_headers(seeded_admin),
    )

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    plan_metrics = [m for m in res.json() if m["type"] == "plan"]
    assert len(plan_metrics) == 6


async def test_generate_plan_requires_facts(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_subscription(db_session, seeded_admin)

    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/generate-plan",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 404


async def test_generate_plan_observer_forbidden(client, seeded_company, seeded_observer, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed_facts(db_session, seeded_company.id)

    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/generate-plan",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403
