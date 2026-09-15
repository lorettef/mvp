from sqlalchemy import func, select

from .conftest import auth_headers
from app.models.financing import Financing


async def _post(client, company_id, user, payload):
    return await client.post(
        f"/api/v1/companies/{company_id}/financing",
        json=payload,
        headers=auth_headers(user),
    )


async def _count(db) -> int:
    r = await db.execute(select(func.count()).select_from(Financing))
    return r.scalar_one()


async def test_create_founder_investment(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "founder",
         "counterparty_name": "Иван Иванов", "amount": 500000,
         "issued_date": "2026-01-15"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["type"] == "investment"
    assert body["investor_type"] == "founder"
    assert body["counterparty_name"] == "Иван Иванов"
    assert body["amount"] == 500000
    assert body["currency"] == "RUB"
    assert body["issued_date"] == "2026-01-15"


async def test_create_fund_investment(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "fund",
         "counterparty_name": "VC Fund X", "amount": 1000000},
    )
    assert res.status_code == 201, res.text
    assert res.json()["investor_type"] == "fund"


async def test_create_loan(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "loan", "counterparty_name": "Банк",
         "amount": 100000, "annual_rate": 15.0, "term_months": 12,
         "repayment_type": "annuity", "issued_date": "2026-06-01"},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["type"] == "loan"
    assert body["annual_rate"] == 15.0
    assert body["term_months"] == 12
    assert body["repayment_type"] == "annuity"


async def test_list_multiple_financing(client, seeded_company, seeded_admin, db_session):
    db_session.add(Financing(
        company_id=seeded_company.id, type="investment",
        investor_type="founder", amount=100.0,
    ))
    db_session.add(Financing(
        company_id=seeded_company.id, type="loan",
        counterparty_name="Банк", amount=200.0, annual_rate=10.0, term_months=12,
    ))
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/financing",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert len(res.json()) == 2


async def test_update_financing(client, seeded_company, seeded_admin):
    created = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "founder", "amount": 100000},
    )
    fid = created.json()["id"]

    res = await client.patch(
        f"/api/v1/companies/{seeded_company.id}/financing/{fid}",
        json={"amount": 750000, "counterparty_name": "Новый инвестор"},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200, res.text
    assert res.json()["amount"] == 750000
    assert res.json()["counterparty_name"] == "Новый инвестор"


async def test_delete_financing(client, seeded_company, seeded_admin, db_session):
    created = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "fund", "amount": 100000},
    )
    fid = created.json()["id"]

    res = await client.delete(
        f"/api/v1/companies/{seeded_company.id}/financing/{fid}",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert await _count(db_session) == 0


async def test_amount_must_be_positive(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "founder", "amount": 0},
    )
    assert res.status_code == 422


async def test_investment_requires_investor_type(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "amount": 100000},
    )
    assert res.status_code == 422


async def test_loan_requires_rate_and_term(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "loan", "counterparty_name": "Банк", "amount": 100000},
    )
    assert res.status_code == 422


async def test_investment_rejects_rate(client, seeded_company, seeded_admin):
    res = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "founder",
         "amount": 100000, "annual_rate": 15.0},
    )
    assert res.status_code == 422


async def test_observer_cannot_write(client, seeded_company, seeded_observer):
    res = await _post(
        client, seeded_company.id, seeded_observer,
        {"type": "investment", "investor_type": "founder", "amount": 100000},
    )
    assert res.status_code == 403


async def test_unauthenticated(client, seeded_company):
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/financing",
        json={"type": "investment", "investor_type": "founder", "amount": 100000},
    )
    assert res.status_code == 401


async def test_tenant_isolation(
    client, seeded_company, seeded_admin, other_company, other_admin
):
    created = await _post(
        client, seeded_company.id, seeded_admin,
        {"type": "investment", "investor_type": "founder", "amount": 100000},
    )
    fid = created.json()["id"]

    res = await client.patch(
        f"/api/v1/companies/{seeded_company.id}/financing/{fid}",
        json={"amount": 1},
        headers=auth_headers(other_admin),
    )
    assert res.status_code == 403
