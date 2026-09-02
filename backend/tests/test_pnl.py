from datetime import date

import pytest

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing
from app.services.pnl_service import PnLService


async def _seed_pnl(db, company_id):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=100000,
            cac=1000,
            ltv=5000,
            churn=0.03,
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
    db.add(Financing(company_id=company_id, type="credit", amount=100000, rate=0.15))
    await db.flush()


async def test_pnl_happy(client, seeded_company, seeded_admin, db_session):
    await _seed_pnl(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/pnl",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["mrr"] == 100000
    assert body["revenue"] == 100000
    assert body["fot"] == 30000
    assert body["social_payments"] == pytest.approx(12960)
    assert body["total_opex"] == pytest.approx(77960)
    assert body["ebitda"] == pytest.approx(22040)
    assert body["financial_expenses"] == pytest.approx(15000)
    assert body["net_profit"] == pytest.approx(7040)
    assert body["ebitda_margin"] == pytest.approx(0.2204)
    assert body["net_margin"] == pytest.approx(0.0704)


async def test_pnl_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/pnl",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["mrr"] is None
    assert body["revenue"] is None
    assert body["ebitda"] is None
    assert body["net_profit"] is None
    assert body["financial_expenses"] == 0


async def test_pnl_no_credits_net_equals_ebitda(
    client, seeded_company, seeded_admin, db_session
):
    db_session.add(
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=50000,
            cac=1000,
            ltv=3000,
            churn=0.04,
        )
    )
    db_session.add(
        Budget(
            company_id=seeded_company.id,
            period=date(2026, 2, 1),
            type="fact",
            marketing=5000,
            development=5000,
            fot=10000,
            gna=2000,
        )
    )
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/pnl",
        headers=auth_headers(seeded_admin),
    )
    body = res.json()
    assert body["financial_expenses"] == 0
    # social = 10000 * 0.432 = 4320; opex = 10000+4320+5000+5000+2000 = 26320
    assert body["total_opex"] == pytest.approx(26320)
    assert body["ebitda"] == pytest.approx(50000 - 26320)
    assert body["net_profit"] == body["ebitda"]


async def test_pnl_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/pnl",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_pnl_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/pnl")
    assert res.status_code == 401


async def test_pnl_falls_back_to_plan_when_no_fact(db_session, seeded_company):
    """Characterization: with ONLY plan data, P&L falls back fact→plan.

    Seeding no `type="fact"` rows proves `get_pnl` still computes values
    from the latest plan Metric / plan Budget instead of returning None.
    """
    db_session.add(
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 2, 1),
            type="plan",
            revenue=100000,
            cac=1000,
            ltv=5000,
            churn=0.03,
        )
    )
    db_session.add(
        Budget(
            company_id=seeded_company.id,
            period=date(2026, 2, 1),
            type="plan",
            marketing=10000,
            development=20000,
            fot=30000,
            gna=5000,
        )
    )
    await db_session.flush()

    pnl = await PnLService(db_session).get_pnl(seeded_company.id)

    assert pnl.mrr is not None
    assert pnl.revenue is not None
    assert pnl.fot is not None
    assert pnl.total_opex is not None
    assert pnl.ebitda is not None
    assert pnl.net_profit is not None
    assert pnl.ebitda_margin is not None
    assert pnl.net_margin is not None
    assert pnl.period == date(2026, 2, 1)
