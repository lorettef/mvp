"""Final acceptance: stored sources agree across financial consumers."""

import pytest

from .conftest import auth_headers


def metric(kind="fact", **changes):
    return (
        dict(
            period="2026-02-01",
            type=kind,
            new_units=10,
            arpu=100,
            revenue=100000,
            marketing_spend=1000,
            retention_rate=0.9,
            comment="Preserve source comment",
        )
        | changes
    )


def budget(kind="fact", **changes):
    return (
        dict(
            period="2026-02-01",
            type=kind,
            marketing=10000,
            development=20000,
            fot=30000,
            gna=5000,
        )
        | changes
    )


async def test_fact_source_updates_agree_across_all_views(
    client, seeded_company, seeded_admin
):
    base = f"/api/v1/companies/{seeded_company.id}"
    headers = auth_headers(seeded_admin)

    async def put(path, body):
        response = await client.put(f"{base}/{path}", headers=headers, json=body)
        assert response.status_code == 200, response.text
        return response.json()

    async def get(path):
        response = await client.get(path, headers=headers)
        assert response.status_code == 200, response.text
        return response.json()

    sources = {}
    for kind in ("plan", "fact"):
        sources[kind] = await put("metrics", metric(kind))
        await put("budgets", budget(kind))
    initial_plan = (await get(f"{base}/pnl"))["periods"][0]["plan"]
    changed_fact = await put(
        "metrics",
        metric(
            revenue=200000,
            new_units=20,
            arpu=300,
            marketing_spend=2000,
            retention_rate=0.8,
        ),
    )
    assert changed_fact["id"] == sources["fact"]["id"]
    stored = await get(f"{base}/metrics")
    assert next(row for row in stored if row["type"] == "plan") == sources["plan"]
    unit = await get(f"{base}/unit-economics")
    assert unit["source_metric"]["id"] == changed_fact["id"]
    assert (unit["revenue"], unit["cac"], unit["ltv"], unit["churn"]) == (
        200000,
        100,
        1500,
        0.2,
    )
    pnl = (await get(f"{base}/pnl"))["periods"][0]
    assert pnl["plan"] == initial_plan
    assert pnl["fact"]["revenue"] == 200000
    assert pnl["fact"]["ebitda"] == 125940
    dashboard = await get("/api/v1/dashboard")
    assert dashboard["portfolio_revenue"] == 200000
    assert dashboard["companies"][0]["fact"]["cac"] == unit["cac"]
    assert dashboard["profitability_by_industry"][0]["ebitda"] == pnl["fact"]["ebitda"]

    await put("budgets", budget(fot=40000))
    pnl_after = (await get(f"{base}/pnl"))["periods"][0]
    assert pnl_after["plan"] == initial_plan
    assert pnl_after["fact"]["social_payments"] == 12080
    assert pnl_after["fact"]["total_opex"] == 87080
    assert pnl_after["fact"]["ebitda"] == 112920
    unit_after = await get(f"{base}/unit-economics")
    assert unit_after["source_metric"] == unit["source_metric"]
    assert unit_after["monthly_burn"] == pnl_after["fact"]["total_opex"]
    dashboard_after = await get("/api/v1/dashboard")
    profit = dashboard_after["profitability_by_industry"][0]
    assert profit["ebitda"] == pnl_after["fact"]["ebitda"]
    assert profit["ebitda_margin"] == pnl_after["fact"]["ebitda_margin"]
    cashflow = await get(f"{base}/cashflow")
    assert cashflow["operating_cf"] == pnl_after["fact"]["net_profit"] == 112920

    # Plan source editing must leave Fact and all actual consumers intact.
    plan_changed = await put("metrics", metric("plan", revenue=300000))
    assert plan_changed["id"] == sources["plan"]["id"]
    assert (await get(f"{base}/pnl"))["periods"][0]["fact"] == pnl_after["fact"]
    assert (await get(f"{base}/unit-economics")) == unit_after
    assert (await get("/api/v1/dashboard"))["portfolio_revenue"] == 200000


@pytest.mark.parametrize("deleted_kind", ["plan", "fact"])
async def test_metric_delete_preserves_same_month_other_scenario(
    client, seeded_company, seeded_admin, deleted_kind
):
    base = f"/api/v1/companies/{seeded_company.id}/metrics"
    headers = auth_headers(seeded_admin)
    sources = {}
    for kind in ("plan", "fact"):
        response = await client.put(base, headers=headers, json=metric(kind))
        assert response.status_code == 200
        sources[kind] = response.json()
    response = await client.delete(
        f"{base}/{sources[deleted_kind]['id']}", headers=headers
    )
    assert response.status_code == 200
    other = "fact" if deleted_kind == "plan" else "plan"
    assert (await client.get(base, headers=headers)).json() == [sources[other]]
