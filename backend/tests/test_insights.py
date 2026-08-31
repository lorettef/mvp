from datetime import date

from .conftest import auth_headers
from app.core.config import settings
from app.models.budget import Budget
from app.models.financing import Financing
from app.models.metric import Metric
from app.models.subscription import Subscription


async def _seed(db, company_id, user):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=200000,
            cac=1000,
            ltv=5000,
            churn=0.035,
        )
    )
    db.add(
        Budget(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            marketing=10000,
            development=20000,
            fot=30000,
            gna=5000,
        )
    )
    db.add(Financing(company_id=company_id, type="investment", amount=200000))
    db.add(Financing(company_id=company_id, type="credit", amount=100000, rate=0.15))
    db.add(
        Subscription(
            user_id=user.id,
            plan="pro",
            status="active",
            daily_limit=10,
        )
    )
    await db.flush()


async def _post(client, company_id, user, scenario):
    return await client.post(
        f"/api/v1/companies/{company_id}/insights/{scenario}",
        headers=auth_headers(user),
    )


async def test_insight_unit_economics(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed(db_session, seeded_company.id, seeded_admin)

    res = await _post(client, seeded_company.id, seeded_admin, "unit_economics")
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "demo"
    assert body["scenario"] == "unit_economics"
    assert body["text"]


async def test_insight_valuation(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed(db_session, seeded_company.id, seeded_admin)

    res = await _post(client, seeded_company.id, seeded_admin, "valuation")
    assert res.status_code == 200
    assert res.json()["scenario"] == "valuation"
    assert res.json()["text"]


async def test_insight_cohorts_empty(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed(db_session, seeded_company.id, seeded_admin)

    res = await _post(client, seeded_company.id, seeded_admin, "cohorts")
    assert res.status_code == 200
    assert res.json()["scenario"] == "cohorts"


async def test_insight_unknown_scenario(client, seeded_company, seeded_admin, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed(db_session, seeded_company.id, seeded_admin)

    res = await _post(client, seeded_company.id, seeded_admin, "does_not_exist")
    assert res.status_code == 422


async def test_insight_observer_forbidden(client, seeded_company, seeded_observer, db_session, monkeypatch):
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")
    await _seed(db_session, seeded_company.id, seeded_observer)

    res = await _post(client, seeded_company.id, seeded_observer, "pnl")
    assert res.status_code == 403


async def test_insight_unauthenticated(client, seeded_company):
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/insights/pnl"
    )
    assert res.status_code == 401
