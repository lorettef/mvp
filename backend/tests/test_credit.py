from datetime import date

import pytest

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_company_data(db, company_id, mrr=50000):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            mrr=mrr,
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
    await db.flush()


async def test_credit_gap_detected(client, seeded_company, seeded_admin, db_session):
    # стартовый кэш 100000, ежемесячный убыток ~25k → разрыв в течение года
    db_session.add(
        Financing(company_id=seeded_company.id, type="investment", amount=100000)
    )
    await _seed_company_data(db_session, seeded_company.id, mrr=50000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()

    assert body["geography"] == "RU"
    assert body["key_rate"] == pytest.approx(21.0)
    assert body["credit_rate"] == pytest.approx(26.0)
    assert body["opening_cash"] == 100000
    assert len(body["months"]) == 12

    assert len(body["gaps"]) >= 1
    first_gap = body["gaps"][0]
    assert first_gap["gap"] > 0
    assert first_gap["credit_amount"] == pytest.approx(
        round(first_gap["gap"] * 1.10, 2)
    )
    assert first_gap["rate"] == pytest.approx(26.0)

    # сумма кредита = сумма всех разрывов с буфером
    expected_total = round(
        sum(g["credit_amount"] for g in body["gaps"]), 2
    )
    assert body["total_credit_needed"] == pytest.approx(expected_total)

    # после применения кредитов остаток неотрицателен во всех месяцах
    for m in body["months"]:
        assert m["balance_after"] >= 0


async def test_credit_no_gap(client, seeded_company, seeded_admin, db_session):
    # прибыльная компания без стартового кэша → разрывов нет
    await _seed_company_data(db_session, seeded_company.id, mrr=100000)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["gaps"] == []
    assert body["total_credit_needed"] == 0
    assert len(body["months"]) == 12


async def test_credit_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["base_revenue"] is None
    assert body["months"] == []
    assert body["gaps"] == []


async def test_credit_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_credit_unauthenticated(client, seeded_company):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/credit-forecast"
    )
    assert res.status_code == 401
