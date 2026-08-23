from datetime import date

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing


async def _seed_report(db, company_id):
    db.add(
        Metric(
            company_id=company_id,
            period=date(2026, 2, 1),
            type="fact",
            mrr=200000,
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


async def test_report_pdf(client, seeded_company, seeded_admin, db_session):
    await _seed_report(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/report/pdf",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("application/pdf")
    assert res.content.startswith(b"%PDF")


async def test_report_excel(client, seeded_company, seeded_admin, db_session):
    await _seed_report(db_session, seeded_company.id)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/report/excel",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert "spreadsheetml" in res.headers["content-type"]
    assert res.content.startswith(b"PK")


async def test_report_pdf_empty(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/report/pdf",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.content.startswith(b"%PDF")


async def test_report_observer_read(client, seeded_company, seeded_observer):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/report/pdf",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200


async def test_report_unauthenticated(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/report/pdf")
    assert res.status_code == 401
