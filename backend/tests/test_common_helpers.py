from datetime import date

from app.core.time import utcnow
from app.models.budget import Budget
from app.models.financing import Financing
from app.models.metric import Metric
from app.services.common import (
    div,
    f,
    financing_sums,
    latest_budget,
    latest_metrics,
)


async def _add_metric(db, cid, type_, period, revenue=1000.0):
    metric = Metric(
        company_id=cid,
        period=period,
        type=type_,
        revenue=revenue,
        churn=0.05,
        ltv=100.0,
        cac=50.0,
    )
    db.add(metric)
    await db.flush()
    return metric


async def _add_budget(db, cid, type_, period, marketing=100.0):
    budget = Budget(
        company_id=cid,
        period=period,
        type=type_,
        marketing=marketing,
        development=0.0,
        fot=0.0,
        gna=0.0,
    )
    db.add(budget)
    await db.flush()
    return budget


async def test_latest_metrics_prefers_fact(db_session, seeded_company):
    cid = seeded_company.id
    await _add_metric(db_session, cid, "fact", date(2026, 2, 1))
    # plan row has a LATER period than the fact row — proves type filter, not just ordering
    await _add_metric(db_session, cid, "plan", date(2026, 3, 1))

    rows = await latest_metrics(db_session, cid, prefer="fact")

    assert len(rows) == 1
    assert rows[0].type == "fact"
    assert rows[0].period == date(2026, 2, 1)


async def test_latest_metrics_prefers_plan(db_session, seeded_company):
    cid = seeded_company.id
    await _add_metric(db_session, cid, "fact", date(2026, 2, 1))
    await _add_metric(db_session, cid, "plan", date(2026, 3, 1))

    rows = await latest_metrics(db_session, cid, prefer="plan")

    assert len(rows) == 1
    assert rows[0].type == "plan"
    assert rows[0].period == date(2026, 3, 1)


async def test_latest_metrics_fallback_to_plan(db_session, seeded_company):
    cid = seeded_company.id
    await _add_metric(db_session, cid, "plan", date(2026, 3, 1))

    rows = await latest_metrics(db_session, cid, prefer="fact", fallback=True)

    assert len(rows) == 1
    assert rows[0].type == "plan"


async def test_latest_metrics_limit_2(db_session, seeded_company):
    cid = seeded_company.id
    for month in (1, 2, 3):
        await _add_metric(db_session, cid, "fact", date(2026, month, 1), revenue=month * 1000.0)

    rows = await latest_metrics(db_session, cid, prefer="fact", limit=2)

    assert len(rows) == 2
    assert rows[0].period == date(2026, 3, 1)
    assert rows[1].period == date(2026, 2, 1)


async def test_latest_metrics_empty(db_session, seeded_company):
    rows = await latest_metrics(db_session, seeded_company.id, prefer="fact")

    assert rows == []


async def test_latest_budget_returns_budget(db_session, seeded_company):
    cid = seeded_company.id
    budget = await _add_budget(db_session, cid, "fact", date(2026, 2, 1))

    got = await latest_budget(db_session, cid)

    assert got is not None
    assert got.id == budget.id
    assert got.type == "fact"


async def test_latest_budget_falls_back_to_plan(db_session, seeded_company):
    cid = seeded_company.id
    budget = await _add_budget(db_session, cid, "plan", date(2026, 2, 1))

    got = await latest_budget(db_session, cid)

    assert got is not None
    assert got.id == budget.id
    assert got.type == "plan"


async def test_latest_budget_none_when_empty(db_session, seeded_company):
    got = await latest_budget(db_session, seeded_company.id)

    assert got is None


def test_f_and_div():
    assert f(None) == 0.0
    assert f(3.0) == 3.0
    assert div(1, 0) == 0.0
    assert div(1, 4) == 0.25


async def test_financing_sums(db_session, seeded_company):
    cid = seeded_company.id
    db_session.add(Financing(company_id=cid, type="credit", amount=100.0))
    db_session.add(Financing(company_id=cid, type="investment", amount=200.0))
    await db_session.flush()

    sums = await financing_sums(db_session, cid)

    assert sums.debt == 100.0
    assert sums.cash == 200.0
    assert sums.total == 300.0


async def test_financing_sums_empty(db_session, seeded_company):
    sums = await financing_sums(db_session, seeded_company.id)

    assert sums.debt == 0.0
    assert sums.cash == 0.0
    assert sums.total == 0.0


def test_utcnow_naive():
    assert utcnow().tzinfo is None
