"""E12 native Budget source contracts and paired P&L consistency."""

import pytest

from .conftest import auth_headers


def payload(kind="plan", **overrides):
    return (
        dict(
            period="2026-02-01",
            type=kind,
            marketing=10000,
            development=20000,
            fot=30000,
            gna=5000,
        )
        | overrides
    )


@pytest.mark.parametrize("role", ["admin", "company"])
async def test_budget_plan_fact_upsert_pnl_isolation(
    client, seeded_company, seeded_admin, seeded_company_user, role
):
    user = seeded_admin if role == "admin" else seeded_company_user
    headers = auth_headers(user)
    base = f"/api/v1/companies/{seeded_company.id}"
    for kind, revenue in [("plan", 200000), ("fact", 100000)]:
        res = await client.put(
            f"{base}/metrics",
            headers=headers,
            json=dict(
                period="2026-02-01",
                type=kind,
                new_units=10,
                arpu=100,
                revenue=revenue,
                marketing_spend=1000,
                retention_rate=0.9,
            ),
        )
        assert res.status_code == 200

    async def save(data):
        res = await client.put(f"{base}/budgets", json=data, headers=headers)
        assert res.status_code == 200, res.text
        return res.json()

    plan = await save(payload("plan"))
    fact = await save(payload("fact"))
    assert plan["id"] != fact["id"]
    before = (await client.get(f"{base}/pnl", headers=headers)).json()["periods"][0]
    updated = await save(
        payload("plan", marketing=0, development=20.25, fot=40000, gna=0)
    )
    assert updated["id"] == plan["id"]
    rows = (await client.get(f"{base}/budgets", headers=headers)).json()
    assert len(rows) == 2
    assert next(r for r in rows if r["type"] == "fact") == fact
    after = (await client.get(f"{base}/pnl", headers=headers)).json()["periods"][0]
    assert after["fact"] == before["fact"]
    assert after["plan"]["budget_source"]["id"] == plan["id"]
    assert after["plan"]["social_payments"] == 12080
    assert after["plan"]["total_opex"] == 52100.25
    assert after["plan"]["ebitda"] == 147899.75
    assert after["plan"]["financial_expenses"] is None
    assert after["fact"]["ebitda"] == 25940
    # Symmetric update: Fact does not mutate Plan or its P&L values.
    updated_fact = await save(payload("fact", gna=0))
    assert updated_fact["id"] == fact["id"]
    final = (await client.get(f"{base}/pnl", headers=headers)).json()["periods"][0]
    assert final["plan"] == after["plan"]
    assert final["fact"]["ebitda"] == 30940


@pytest.mark.parametrize("deleted_kind", ["plan", "fact"])
async def test_delete_exact_scenario_leaves_other(
    client, seeded_company, seeded_admin, deleted_kind
):
    base = f"/api/v1/companies/{seeded_company.id}"
    headers = auth_headers(seeded_admin)
    saved = {}
    for kind in ("plan", "fact"):
        res = await client.put(f"{base}/budgets", json=payload(kind), headers=headers)
        assert res.status_code == 200
        saved[kind] = res.json()
    res = await client.delete(
        f'{base}/budgets/{saved[deleted_kind]["id"]}', headers=headers
    )
    assert res.status_code == 200
    other = "fact" if deleted_kind == "plan" else "plan"
    assert (await client.get(f"{base}/budgets", headers=headers)).json() == [
        saved[other]
    ]
    paired = (await client.get(f"{base}/pnl", headers=headers)).json()["periods"][0]
    assert paired[deleted_kind] is None
    assert paired[other]["budget_source"]["id"] == saved[other]["id"]


async def test_budget_permissions_and_source_ownership(
    client, seeded_company, seeded_admin, seeded_observer, other_company, other_admin
):
    base = f"/api/v1/companies/{seeded_company.id}"
    saved = await client.put(
        f"{base}/budgets", json=payload(), headers=auth_headers(seeded_admin)
    )
    assert saved.status_code == 200
    source_id = saved.json()["id"]
    assert (
        await client.get(f"{base}/budgets", headers=auth_headers(seeded_observer))
    ).status_code == 200
    for user in (seeded_observer, other_admin):
        assert (
            await client.put(
                f"{base}/budgets", json=payload(), headers=auth_headers(user)
            )
        ).status_code == 403
        assert (
            await client.delete(
                f"{base}/budgets/{source_id}", headers=auth_headers(user)
            )
        ).status_code == 403
    assert (
        await client.get(f"{base}/budgets", headers=auth_headers(other_admin))
    ).status_code == 403
    assert (
        await client.delete(
            f"/api/v1/companies/{other_company.id}/budgets/{source_id}",
            headers=auth_headers(other_admin),
        )
    ).status_code == 404
    assert (
        await client.get(f"{base}/budgets", headers=auth_headers(seeded_admin))
    ).json() == [saved.json()]


@pytest.mark.parametrize("field", ["marketing", "development", "fot", "gna"])
@pytest.mark.parametrize("bad_value", [None, -1, "NaN", "not a number"])
async def test_invalid_budget_article_rejected(
    client, seeded_company, seeded_admin, field, bad_value
):
    data = payload()
    if bad_value is None:
        del data[field]
    else:
        data[field] = bad_value
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/budgets",
        json=data,
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422


async def test_zero_decimal_and_future_plan(client, seeded_company, seeded_admin):
    base = f"/api/v1/companies/{seeded_company.id}"
    headers = auth_headers(seeded_admin)
    data = payload(period="2030-11-01", marketing=0, development=0.25, fot=0, gna=12.34)
    res = await client.put(f"{base}/budgets", json=data, headers=headers)
    assert res.status_code == 200
    assert {key: res.json()[key] for key in data} == data
    paired = (await client.get(f"{base}/pnl", headers=headers)).json()["periods"][0]
    assert paired["period"] == "2030-11-01"
    assert paired["plan"]["budget_source"]["id"] == res.json()["id"]
    assert paired["plan"]["fot"] == 0
    assert paired["fact"] is None
