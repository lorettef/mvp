from datetime import date

import pytest

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_valuation(db, company_id, mrr=100000):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=mrr,
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


async def test_valuation_happy(client, seeded_company, seeded_admin, db_session):
    await _seed_valuation(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/valuation",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["geography"] == "RU"
    assert body["key_rate"] == pytest.approx(21.0)
    assert body["discount_rate"] == pytest.approx(31.0)
    assert body["growth_rate"] == pytest.approx(8.5)

    # FCF = операционный CF = чистая прибыль = 7040
    assert body["fcf"] == pytest.approx(7040)

    r = 0.31
    g = 0.085
    expected_tv = 7040 * (1 + g) / (r - g)
    assert body["terminal_value"] == pytest.approx(expected_tv, rel=1e-3)

    # чистый долг = кредит 100000 - инвестиции 200000 = -100000
    assert body["debt"] == 100000
    assert body["cash"] == 200000
    assert body["net_debt"] == pytest.approx(-100000)

    expected_equity = expected_tv - (-100000)
    assert body["equity_value"] == pytest.approx(expected_equity, rel=1e-3)

    assert body["revenue_annual"] == pytest.approx(1200000)
    assert body["ps_ratio"] == pytest.approx(expected_equity / 1200000, rel=1e-3)

    assert body["headcount"] >= 1
    assert body["value_per_employee"] == pytest.approx(
        expected_equity / body["headcount"], rel=1e-3
    )


async def test_valuation_loss_unapplicable(
    client, seeded_company, seeded_admin, db_session
):
    # убыточная компания (opex > mrr) → FCF < 0 → модель неприменима
    await _seed_valuation(db_session, seeded_company.id, mrr=20000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/valuation",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fcf"] < 0
    assert body["terminal_value"] is None
    assert body["equity_value"] is None
    assert body["ps_ratio"] is None


async def test_valuation_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/valuation",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["fcf"] is None
    assert body["terminal_value"] is None
    assert body["equity_value"] is None
    assert body["headcount"] == 0


async def test_valuation_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/valuation",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_valuation_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/valuation")
    assert res.status_code == 401
