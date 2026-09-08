from datetime import date

import pytest

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_cashflow(db, company_id):
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
    db.add(Financing(company_id=company_id, type="investment", amount=200000))
    db.add(Financing(company_id=company_id, type="credit", amount=100000, rate=0.15))
    await db.flush()


async def test_cashflow_happy(client, seeded_company, seeded_admin, db_session):
    await _seed_cashflow(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/cashflow",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    # чистая прибыль из P&L = 20790 (mrr 100000 − opex 77960 − месячные % 1250)
    assert body["net_profit"] == pytest.approx(20790)
    assert body["operating_cf"] == pytest.approx(20790)
    assert body["investing_cf"] == 0
    assert body["investments"] == 200000
    assert body["credits"] == 100000
    assert body["financing_cf"] == pytest.approx(300000)
    assert body["total_cf"] == pytest.approx(320790)
    assert body["opening_balance"] == 0
    assert body["closing_balance"] == pytest.approx(320790)


async def test_cashflow_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/cashflow",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["net_profit"] is None
    assert body["operating_cf"] is None
    assert body["total_cf"] is None
    assert body["closing_balance"] is None
    assert body["investments"] == 0
    assert body["credits"] == 0


async def test_cashflow_investment_only(client, seeded_company, seeded_admin, db_session):
    db_session.add(
        Financing(company_id=seeded_company.id, type="investment", amount=500000)
    )
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/cashflow",
        headers=auth_headers(seeded_admin),
    )
    body = res.json()
    assert body["investments"] == 500000
    assert body["credits"] == 0


async def test_cashflow_financing_sums_match(
    client, seeded_company, seeded_admin, db_session
):
    """Characterization: инвестиции и кредиты суммируются по своим типам."""
    db_session.add(
        Financing(company_id=seeded_company.id, type="investment", amount=200)
    )
    db_session.add(
        Financing(company_id=seeded_company.id, type="credit", amount=100, rate=0.15)
    )
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/cashflow",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["investments"] == 200.0
    assert body["credits"] == 100.0


async def test_cashflow_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/cashflow",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_cashflow_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/cashflow")
    assert res.status_code == 401


async def test_cashflow_multi_month_chronological_accumulation(client, seeded_company, seeded_admin, db_session):
    """Closing balance накапливается хронологически (старый → новый), не в обратном порядке."""
    for i, (m, rev) in enumerate(((1, 100000), (2, 200000), (3, 300000))):
        db_session.add(
            Metric(
                company_id=seeded_company.id,
                period=date(2026, m, 1),
                type="fact",
                revenue=rev,
                cac=1000,
                ltv=5000,
                churn=0.03,
            )
        )
        db_session.add(
            Budget(
                company_id=seeded_company.id,
                period=date(2026, m, 1),
                type="fact",
                marketing=0,
                development=0,
                fot=0,
                gna=0,
            )
        )
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/cashflow?months=3",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200, res.text
    body = res.json()

    # months DESC: 2026-03, 2026-02, 2026-01
    assert [m["period"] for m in body["months"]] == [
        "2026-03-01", "2026-02-01", "2026-01-01",
    ]
    by_period = {m["period"]: m for m in body["months"]}

    # operating_cf = revenue (opex=0), closing накапливается: 100k → 300k → 600k
    assert by_period["2026-01-01"]["closing_balance"] == pytest.approx(100000)
    assert by_period["2026-02-01"]["closing_balance"] == pytest.approx(300000)
    assert by_period["2026-03-01"]["closing_balance"] == pytest.approx(600000)
    # top-level closing = последний (самый новый) месяц
    assert body["closing_balance"] == pytest.approx(600000)
