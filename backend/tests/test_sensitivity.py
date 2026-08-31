from datetime import date

import pytest

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_sensitivity(db, company_id, mrr=200000):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=mrr,
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
    await db.flush()


async def test_sensitivity_happy(client, seeded_company, seeded_admin, db_session):
    await _seed_sensitivity(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/sensitivity",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    base = body["base"]
    cons = body["conservative"]

    # стресс-факторы применены к метрикам
    assert base["mrr"] == 200000
    assert cons["mrr"] == pytest.approx(180000)
    assert cons["cac"] == pytest.approx(1100)
    assert cons["ltv"] == pytest.approx(4750)
    assert cons["churn"] == pytest.approx(0.0385)

    # базовый FCF положителен
    assert base["fcf"] > 0
    assert base["equity_value"] is not None

    # консервативный FCF ниже базового (маркетинг +10%, MRR -10%)
    assert cons["fcf"] < base["fcf"]
    assert cons["equity_value"] < base["equity_value"]

    # дельта корректна
    assert body["equity_delta"] == pytest.approx(
        cons["equity_value"] - base["equity_value"], rel=1e-3
    )
    assert body["equity_delta_pct"] == pytest.approx(
        body["equity_delta"] / base["equity_value"] * 100, rel=1e-3
    )


async def test_sensitivity_conservative_unprofitable(
    client, seeded_company, seeded_admin, db_session
):
    # компания с низким MRR → консервативный сценарий уводит в убыток
    await _seed_sensitivity(db_session, seeded_company.id, mrr=80000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/sensitivity",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["conservative"]["fcf"] <= 0
    assert body["conservative"]["equity_value"] is None


async def test_sensitivity_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/sensitivity",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["base"]["mrr"] is None
    assert body["conservative"]["mrr"] is None


async def test_sensitivity_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/sensitivity",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_sensitivity_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/sensitivity")
    assert res.status_code == 401
