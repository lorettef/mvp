"""COGS source identity and canonical Gross Margin through real ASGI endpoints."""

import pytest

from app.services.gross_profit import gross_profit
from .conftest import auth_headers


def metric(period="2026-10-01", type_="fact", revenue=100000):
    return dict(
        period=period,
        type=type_,
        new_units=10,
        arpu=100,
        revenue=revenue,
        marketing_spend=10000,
        retention_rate=0.9,
    )


def budget(period="2026-10-01", type_="fact", **extra):
    return dict(
        period=period,
        type=type_,
        marketing=100,
        development=200,
        fot=300,
        gna=400,
        **extra,
    )


@pytest.mark.parametrize(
    "revenue,cogs,profit,margin",
    [
        (100, 40, 60, 0.6),
        (100, 0, 100, 1),
        (0, 40, -40, None),
        (100, None, None, None),
        (None, 40, None, None),
        (100, 150, -50, -0.5),
    ],
)
def test_canonical_gross_arithmetic(revenue, cogs, profit, margin):
    result = gross_profit(revenue, cogs)
    assert result.gross_profit == profit
    assert result.gross_margin == margin


async def put(client, base, kind, headers, payload):
    r = await client.put(f"{base}/{kind}", headers=headers, json=payload)
    assert r.status_code == 200, r.text
    return r.json()


@pytest.mark.parametrize("cogs", [0, 40, 12.34, None])
async def test_budget_additive_create_update_legacy_and_delete(
    client, seeded_company, seeded_admin, cogs
):
    base = f"/api/v1/companies/{seeded_company.id}"
    headers = auth_headers(seeded_admin)
    old = await put(client, base, "budgets", headers, budget(type_="plan"))
    assert old["cogs"] is None
    fact = await put(client, base, "budgets", headers, budget(cogs=cogs))
    assert fact["cogs"] == cogs
    changed = await put(client, base, "budgets", headers, budget(cogs=25.75))
    assert changed["id"] == fact["id"] and changed["cogs"] == 25.75
    # An older client updating OPEX must not erase a newer client's COGS.
    legacy = await put(client, base, "budgets", headers, budget())
    assert legacy["cogs"] == 25.75
    assert (
        await client.delete(f"{base}/budgets/{fact['id']}", headers=headers)
    ).status_code == 200
    remaining = (await client.get(f"{base}/budgets", headers=headers)).json()
    assert [r["id"] for r in remaining] == [old["id"]]
    assert remaining[0]["cogs"] is None


@pytest.mark.parametrize("invalid", [-1, "NaN", "Infinity", "abc"])
async def test_budget_rejects_invalid_cogs(
    client, seeded_company, seeded_admin, invalid
):
    r = await client.put(
        f"/api/v1/companies/{seeded_company.id}/budgets",
        headers=auth_headers(seeded_admin),
        json=budget(cogs=invalid),
    )
    assert r.status_code == 422


async def test_asgi_cogs_refreshes_gross_and_payback_but_preserves_ebitda_cashflow(
    client, seeded_company, seeded_admin
):
    base, h = f"/api/v1/companies/{seeded_company.id}", auth_headers(seeded_admin)
    await put(client, base, "metrics", h, metric())
    await put(client, base, "budgets", h, budget(cogs=40000))
    await put(client, base, "metrics", h, metric(type_="plan", revenue=200000))
    await put(client, base, "budgets", h, budget(type_="plan", cogs=20000))

    async def read(kind):
        r = await client.get(f"{base}/{kind}", headers=h)
        assert r.status_code == 200, r.text
        return r.json()

    before = await read("pnl")
    cf_before = await read("cashflow")
    fact, plan = before["periods"][0]["fact"], before["periods"][0]["plan"]
    assert (fact["cogs"], fact["gross_profit"], fact["gross_margin"]) == (
        40000,
        60000,
        0.6,
    )
    assert (plan["cogs"], plan["gross_profit"], plan["gross_margin"]) == (
        20000,
        180000,
        0.9,
    )
    ue = await read("unit-economics")
    assert ue["gross_margin"] == 0.6 and ue["payback_period"] == 16.67
    await put(client, base, "budgets", h, budget(cogs=50000))
    after, ue = await read("pnl"), await read("unit-economics")
    updated = after["periods"][0]["fact"]
    assert updated["gross_margin"] == 0.5 and ue["gross_margin"] == 0.5
    assert ue["payback_period"] == 20
    for key in ["ebitda", "total_opex", "social_payments", "net_profit"]:
        assert updated[key] == fact[key]
    assert after["periods"][0]["plan"] == plan
    assert after["months"] == before["months"]  # Legacy mixed P&L unchanged.
    assert await read("cashflow") == cf_before


@pytest.mark.parametrize("type_", ["fact", "plan"])
async def test_unit_exact_scenario_period_and_legacy_independence(
    client, seeded_company, seeded_admin, type_
):
    base, h = f"/api/v1/companies/{seeded_company.id}", auth_headers(seeded_admin)
    await put(client, base, "metrics", h, metric(type_=type_))
    # Wrong scenario and unrelated latest period must not contribute COGS.
    await put(
        client,
        base,
        "budgets",
        h,
        budget(type_="plan" if type_ == "fact" else "fact", cogs=1),
    )
    await put(
        client, base, "budgets", h, budget(period="2026-11-01", type_=type_, cogs=1)
    )

    async def unit():
        return (await client.get(f"{base}/unit-economics", headers=h)).json()

    empty = await unit()
    assert empty["gross_margin"] is None and empty["payback_period"] is None
    assert empty["source_metric"]["type"] == type_
    assert (
        await client.patch(base, headers=h, json={"gross_margin": 0.99})
    ).status_code == 200
    assert (await unit())["gross_margin"] is None
    for cogs, margin, payback in [
        (0, 1, 10),
        (150000, -0.5, None),
        (100000, 0, None),
        (None, None, None),
    ]:
        await put(client, base, "budgets", h, budget(type_=type_, cogs=cogs))
        result = await unit()
        assert result["gross_margin"] == margin and result["payback_period"] == payback
    await put(client, base, "metrics", h, metric(type_=type_, revenue=0))
    await put(client, base, "budgets", h, budget(type_=type_, cogs=0))
    assert (await unit())["gross_margin"] is None


async def test_partial_pnl_and_cogs_tenant_permissions(
    client, seeded_company, seeded_admin, seeded_observer, other_company, other_admin
):
    base, h = f"/api/v1/companies/{seeded_company.id}", auth_headers(seeded_admin)
    await put(client, base, "metrics", h, metric())
    await put(client, base, "budgets", h, budget(type_="plan", cogs=40))
    periods = (await client.get(f"{base}/pnl", headers=h)).json()["periods"]
    assert periods[0]["fact"]["gross_margin"] is None
    assert periods[0]["plan"]["gross_profit"] is None
    assert periods[0]["plan"]["cogs"] == 40
    for actor in [seeded_observer, other_admin]:
        assert (
            await client.put(
                f"{base}/budgets", headers=auth_headers(actor), json=budget(cogs=5)
            )
        ).status_code == 403
    assert (
        await client.get(f"{base}/unit-economics", headers=auth_headers(other_admin))
    ).status_code == 403
    assert (
        await client.get(
            f"{base}/unit-economics", headers=auth_headers(seeded_observer)
        )
    ).status_code == 200
