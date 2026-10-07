"""E11A scenarios; existing P&L/Cash Flow tests characterize legacy behavior."""

from datetime import date

import pytest
from sqlalchemy import event

from app.models.budget import Budget
from app.models.financing import Financing
from app.models.hiring_settings import HiringSettings
from app.models.metric import Metric
from app.services.pnl_service import PnLService
from .conftest import auth_headers


def metric(cid, period, kind, revenue=100000):
    return Metric(
        company_id=cid,
        period=period,
        type=kind,
        new_units=7,
        arpu=1234.56,
        revenue=revenue,
        marketing_spend=876.54,
        retention_rate=0.97,
        comment="Keep comment",
        cac=125.22,
        ltv=41152,
        churn=0.03,
    )


def budget(cid, period, kind):
    return Budget(
        company_id=cid,
        period=period,
        type=kind,
        fot=30000,
        marketing=10000,
        development=20000,
        gna=5000,
    )


@pytest.mark.parametrize(
    "mt,bt",
    [
        ("fact", "fact"),
        ("plan", "plan"),
        ("fact", "plan"),
        ("plan", "fact"),
        ("fact", None),
        (None, "fact"),
        ("plan", None),
        (None, "plan"),
        (None, None),
    ],
)
async def test_scenarios(client, db_session, seeded_company, seeded_admin, mt, bt):
    p = date(2026, 2, 1)
    m = metric(seeded_company.id, p, mt) if mt else None
    b = budget(seeded_company.id, p, bt) if bt else None
    db_session.add_all([x for x in (m, b) if x is not None])
    await db_session.flush()
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/pnl", headers=auth_headers(seeded_admin)
    )
    assert res.status_code == 200, res.text
    pairs = res.json()["periods"]
    if not mt and not bt:
        assert pairs == []
        return
    assert pairs[0]["period"] == p.isoformat()
    for kind in ("plan", "fact"):
        s = pairs[0][kind]
        hm, hb = mt == kind, bt == kind
        if not hm and not hb:
            assert s is None
            continue
        assert "source" not in s
        assert s["revenue"] == (100000 if hm else None)
        assert s["fot"] == (30000 if hb else None)
        assert s["social_payments"] == (9060 if hb else None)
        assert s["total_opex"] == (74060 if hb else None)
        assert s["ebitda"] == (25940 if hm and hb else None)
        assert s["ebitda_margin"] == (0.2594 if hm and hb else None)
        assert s["financial_expenses"] == (0 if kind == "fact" else None)
        assert s["net_profit"] == (25940 if kind == "fact" and hm and hb else None)
        assert s["net_margin"] == (0.2594 if kind == "fact" and hm and hb else None)
        assert s["metric_source"] == (
            dict(
                id=str(m.id),
                period=p.isoformat(),
                type=kind,
                new_units=7,
                arpu=1234.56,
                revenue=100000,
                marketing_spend=876.54,
                retention_rate=0.97,
                comment="Keep comment",
            )
            if hm
            else None
        )
        assert s["budget_source"] == (
            dict(
                id=str(b.id),
                period=p.isoformat(),
                type=kind,
                fot=30000,
                marketing=10000,
                development=20000,
                gna=5000,
            )
            if hb
            else None
        )
    if mt and bt and mt != bt:
        assert res.json()["months"][0]["source"] == "mixed"


async def test_both_scenarios_interest_rates(db_session, seeded_company):
    p = date(2026, 2, 1)
    for kind in ("plan", "fact"):
        db_session.add_all(
            [metric(seeded_company.id, p, kind), budget(seeded_company.id, p, kind)]
        )
    db_session.add(
        HiringSettings(
            company_id=seeded_company.id,
            ndfl_rate=0.13,
            insurance_rate=0.2,
            injury_rate=0.01,
        )
    )
    db_session.add(
        Financing(
            company_id=seeded_company.id,
            type="loan",
            amount=100000,
            annual_rate=15,
            issued_date=p,
        )
    )
    await db_session.flush()
    pair = (await PnLService(db_session).get_pnl(seeded_company.id)).periods[0]
    assert pair.fact.metric_source.id != pair.plan.metric_source.id
    assert pair.fact.budget_source.id != pair.plan.budget_source.id
    for s in (pair.plan, pair.fact):
        assert s.social_payments == 6300
        assert s.total_opex == 71300
        assert s.ebitda == 28700
        assert s.ebitda_margin == 0.287
    assert pair.fact.financial_expenses == 1250
    assert pair.fact.net_profit == 27450
    assert pair.fact.net_margin == 0.2745
    assert pair.plan.financial_expenses is None
    assert pair.plan.net_profit is None
    assert pair.plan.net_margin is None


async def test_zero(db_session, seeded_company):
    p = date(2026, 2, 1)
    db_session.add_all(
        [
            metric(seeded_company.id, p, "fact", 0),
            Budget(
                company_id=seeded_company.id,
                period=p,
                type="fact",
                fot=0,
                marketing=0,
                development=0,
                gna=0,
            ),
        ]
    )
    await db_session.flush()
    s = (await PnLService(db_session).get_pnl(seeded_company.id)).periods[0].fact
    for key in (
        "revenue",
        "fot",
        "social_payments",
        "total_opex",
        "ebitda",
        "financial_expenses",
        "net_profit",
    ):
        assert getattr(s, key) == 0
    assert s.ebitda_margin is None
    assert s.net_margin is None


async def test_union_future_horizon_order(db_session, seeded_company, monkeypatch):
    monkeypatch.setattr("app.services.pnl_service.today", lambda: date(2026, 10, 7))
    for month in range(1, 13):
        db_session.add(
            metric(
                seeded_company.id,
                date(2026, month, 1),
                "fact" if month <= 10 else "plan",
            )
        )
    db_session.add(budget(seeded_company.id, date(2027, 1, 1), "plan"))
    await db_session.flush()
    pnl = await PnLService(db_session).get_pnl(seeded_company.id)
    assert [p.period for p in pnl.periods] == [
        date(2026, m, 1) for m in range(2, 13)
    ] + [date(2027, 1, 1)]
    assert pnl.periods[-1].fact is None
    assert pnl.periods[-1].plan.revenue is None
    assert pnl.periods[8].fact.metric_source.period == date(2026, 10, 1)
    assert [m.period for m in pnl.months] == [
        date(2026, m, 1) for m in range(10, 0, -1)
    ]
    short = await PnLService(db_session).get_pnl(seeded_company.id, months=3)
    assert [p.period for p in short.periods] == [
        date(2026, 11, 1),
        date(2026, 12, 1),
        date(2027, 1, 1),
    ]
    assert [m.period for m in short.months] == [date(2026, m, 1) for m in (10, 9, 8)]


async def test_bounded_selects(client, db_session, seeded_company, seeded_admin):
    for month in range(1, 13):
        for kind in ("plan", "fact"):
            db_session.add_all(
                [
                    metric(seeded_company.id, date(2026, month, 1), kind),
                    budget(seeded_company.id, date(2026, month, 1), kind),
                ]
            )
    await db_session.flush()
    counts, statements = [], []

    def count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db_session.bind.sync_engine
    event.listen(engine, "before_cursor_execute", count)
    try:
        for months in (1, 12):
            db_session.expunge_all()
            statements.clear()
            res = await client.get(
                f"/api/v1/companies/{seeded_company.id}/pnl?months={months}",
                headers=auth_headers(seeded_admin),
            )
            assert res.status_code == 200
            counts.append(len(statements))
    finally:
        event.remove(engine, "before_cursor_execute", count)
    assert counts[0] == counts[1]
    assert counts[1] <= 8
    print(f"API SELECT count: 1 period={counts[0]}, 12 periods={counts[1]}")


async def test_mutations_and_tenancy(
    client,
    db_session,
    seeded_company,
    seeded_admin,
    seeded_observer,
    other_company,
    other_admin,
):
    p = date(2026, 2, 1)
    db_session.add_all(
        [metric(seeded_company.id, p, "fact"), budget(seeded_company.id, p, "fact")]
    )
    await db_session.flush()
    base = f"/api/v1/companies/{seeded_company.id}"
    headers = auth_headers(seeded_admin)

    async def load():
        res = await client.get(f"{base}/pnl", headers=headers)
        assert res.status_code == 200
        return res.json()["periods"][0]["fact"]

    before = await load()
    for path, key, field, value in [
        ("metrics", "metric_source", "revenue", 200000),
        ("budgets", "budget_source", "fot", 40000),
    ]:
        payload = {k: v for k, v in before[key].items() if k != "id"}
        payload[field] = value
        assert (
            await client.put(
                f"{base}/{path}", json=payload, headers=auth_headers(seeded_observer)
            )
        ).status_code == 403
        assert (
            await client.put(
                f"{base}/{path}", json=payload, headers=auth_headers(other_admin)
            )
        ).status_code == 403
        assert (
            await client.put(f"{base}/{path}", json=payload, headers=headers)
        ).status_code == 200
    after = await load()
    assert after["metric_source"]["id"] == before["metric_source"]["id"]
    assert after["metric_source"]["comment"] == "Keep comment"
    assert after["budget_source"]["id"] == before["budget_source"]["id"]
    assert after["social_payments"] == 12080
    assert after["total_opex"] == 87080
    assert after["ebitda"] == 112920
    assert (
        await client.get(f"/api/v1/companies/{other_company.id}/pnl", headers=headers)
    ).status_code == 403
    for path, key in [("metrics", "metric_source"), ("budgets", "budget_source")]:
        sid = before[key]["id"]
        assert (
            await client.delete(
                f"{base}/{path}/{sid}", headers=auth_headers(seeded_observer)
            )
        ).status_code == 403
        assert (
            await client.delete(
                f"/api/v1/companies/{other_company.id}/{path}/{sid}",
                headers=auth_headers(other_admin),
            )
        ).status_code == 404
        assert (
            await client.delete(f"{base}/{path}/{sid}", headers=headers)
        ).status_code == 200
        if path == "metrics":
            partial = await load()
            assert partial["revenue"] is None
            assert partial["ebitda"] is None
            assert partial["total_opex"] == 87080
    assert (await client.get(f"{base}/pnl", headers=headers)).json()["periods"] == []
