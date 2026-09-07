from datetime import date

from app.core import health as H
from app.models.budget import Budget
from app.models.financing import Financing
from app.models.metric import Metric
from app.services.health_service import HealthService


# --- Pure rule tests (core.health) -------------------------------------------------

async def test_health_no_data_when_no_revenue():
    status, signals, attention = H.evaluate_health(
        revenue=None, prev_revenue=None, retention=None, prev_retention=None,
        cac=None, prev_cac=None, churn=None, plan_revenue=None,
        burn=None, prev_burn=None, cash=None,
    )
    assert status == H.STATUS_NO_DATA
    assert attention[0]["kind"] == "no_data"


async def test_health_critical_low_runway():
    status, signals, _ = H.evaluate_health(
        revenue=1000.0, prev_revenue=900.0, retention=0.95, prev_retention=0.9,
        cac=100.0, prev_cac=100.0, churn=0.05, plan_revenue=800.0,
        burn=50.0, prev_burn=50.0, cash=100.0,  # runway = 2.0
    )
    assert status == H.STATUS_CRITICAL


async def test_health_critical_burn_exceeds_revenue():
    status, _, _ = H.evaluate_health(
        revenue=1000.0, prev_revenue=900.0, retention=0.95, prev_retention=0.9,
        cac=100.0, prev_cac=100.0, churn=0.05, plan_revenue=800.0,
        burn=2000.0, prev_burn=2000.0, cash=None,  # burn > revenue
    )
    assert status == H.STATUS_CRITICAL


async def test_health_critical_churn():
    status, _, _ = H.evaluate_health(
        revenue=1000.0, prev_revenue=900.0, retention=0.75, prev_retention=0.8,
        cac=100.0, prev_cac=100.0, churn=0.25, plan_revenue=800.0,
        burn=None, prev_burn=None, cash=None,
    )
    assert status == H.STATUS_CRITICAL


async def test_health_attention_behind_plan():
    status, _, attention = H.evaluate_health(
        revenue=800.0, prev_revenue=900.0, retention=0.95, prev_retention=0.9,
        cac=100.0, prev_cac=100.0, churn=0.05, plan_revenue=1000.0,
        burn=None, prev_burn=None, cash=None,
    )
    assert status == H.STATUS_ATTENTION
    assert any(a["kind"] == "behind_plan" for a in attention)


async def test_health_attention_retention_declining():
    status, _, attention = H.evaluate_health(
        revenue=1000.0, prev_revenue=900.0, retention=0.85, prev_retention=0.95,
        cac=100.0, prev_cac=100.0, churn=0.15, plan_revenue=800.0,
        burn=None, prev_burn=None, cash=None,
    )
    assert status == H.STATUS_ATTENTION
    assert any(a["kind"] == "retention_declining" for a in attention)


async def test_health_attention_cac_rising():
    status, _, attention = H.evaluate_health(
        revenue=1000.0, prev_revenue=900.0, retention=0.95, prev_retention=0.9,
        cac=150.0, prev_cac=100.0, churn=0.05, plan_revenue=800.0,
        burn=None, prev_burn=None, cash=None,
    )
    assert status == H.STATUS_ATTENTION
    assert any(a["kind"] == "cac_rising" for a in attention)


async def test_health_healthy():
    status, signals, attention = H.evaluate_health(
        revenue=1000.0, prev_revenue=900.0, retention=0.95, prev_retention=0.9,
        cac=90.0, prev_cac=100.0, churn=0.05, plan_revenue=800.0,
        burn=50.0, prev_burn=50.0, cash=1000.0,  # runway = 20
    )
    assert status == H.STATUS_HEALTHY
    assert attention == []


# --- Service integration -----------------------------------------------------------

async def test_health_service_returns_status_and_signals(db_session, seeded_company):
    db_session.add_all([
        Metric(
            company_id=seeded_company.id, period=date(2026, 1, 1), type="fact",
            revenue=900.0, cac=120.0, ltv=300.0, churn=0.08, retention_rate=0.92,
        ),
        Metric(
            company_id=seeded_company.id, period=date(2026, 2, 1), type="fact",
            revenue=1000.0, cac=110.0, ltv=320.0, churn=0.05, retention_rate=0.95,
        ),
        Metric(
            company_id=seeded_company.id, period=date(2026, 2, 1), type="plan",
            revenue=900.0, cac=100.0, ltv=300.0, churn=0.05, retention_rate=0.95,
        ),
        Budget(
            company_id=seeded_company.id, period=date(2026, 2, 1), type="fact",
            marketing=1000.0, development=2000.0, fot=3000.0, gna=400.0,
        ),
        Financing(company_id=seeded_company.id, type="investment", amount=60000.0),
    ])
    await db_session.flush()

    resp = await HealthService(db_session).get_health(seeded_company.id)
    assert resp.company_id == seeded_company.id
    assert resp.status in (H.STATUS_HEALTHY, H.STATUS_ATTENTION, H.STATUS_CRITICAL, H.STATUS_NO_DATA)
    assert {s.key for s in resp.signals} >= {"revenue", "retention", "cac", "burn", "runway"}
    assert resp.summary
    # runway = 60000 / 6400 = 9.375 → 9.4
    runway = next(s for s in resp.signals if s.key == "runway")
    assert runway.direction == "unknown"


async def test_health_service_no_data(db_session, seeded_company):
    resp = await HealthService(db_session).get_health(seeded_company.id)
    assert resp.status == H.STATUS_NO_DATA
    assert resp.signals == []
