from datetime import date
from unittest.mock import patch

from .conftest import auth_headers
from app.models.metric import Metric
from app.models.budget import Budget
from app.models.financing import Financing
from app.services.pnl_service import PnLService
from app.services.recalculate_service import RecalculateService


async def _seed_report(db, company_id):
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
    await db.flush()


async def test_recalculate(client, seeded_company, seeded_admin, db_session):
    await _seed_report(db_session, seeded_company.id)

    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/recalculate",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["company_id"] == str(seeded_company.id)
    assert body["recalculated_at"] is not None
    assert body["summary"]
    # при наличии метрик и бюджета ключевые показатели вычислены
    assert body["revenue"] == 200000
    assert body["equity_value"] is not None


async def test_recalculate_empty(client, seeded_company, seeded_admin):
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/recalculate",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["company_id"] == str(seeded_company.id)
    assert body["summary"]


async def test_recalculate_observer_forbidden_403(client, seeded_company, seeded_observer):
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/recalculate",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403


async def test_recalculate_company_user_allowed(client, seeded_company, seeded_company_user):
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/recalculate",
        headers=auth_headers(seeded_company_user),
    )
    assert res.status_code == 200


async def test_recalculate_unauthenticated(client, seeded_company):
    res = await client.post(f"/api/v1/companies/{seeded_company.id}/recalculate")
    assert res.status_code == 401


async def test_recalculate_calls_pnl_once(db_session, seeded_company):
    """PnL должен вычисляться ровно один раз за пересчёт всех модулей."""
    await _seed_report(db_session, seeded_company.id)

    # AsyncMock на классе не связывает self, поэтому wraps оборачивает вызов реального метода с той же сессией.
    original = PnLService.get_pnl

    async def wrapped(company_id):
        return await original(PnLService(db_session), company_id)

    with patch.object(PnLService, "get_pnl", wraps=wrapped) as spy:
        await RecalculateService(db_session).recalculate(seeded_company.id)

    assert spy.await_count == 1
