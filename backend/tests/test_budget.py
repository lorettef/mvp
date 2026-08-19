from .conftest import auth_headers


def _budget_payload(
    period="2026-01-01",
    type_="fact",
    marketing=100000,
    development=200000,
    fot=300000,
    gna=50000,
):
    return {
        "period": period,
        "type": type_,
        "marketing": marketing,
        "development": development,
        "fot": fot,
        "gna": gna,
    }


async def test_upsert_budget_creates(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/budgets",
        json=_budget_payload(),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["marketing"] == 100000
    assert body["development"] == 200000
    assert body["fot"] == 300000
    assert body["gna"] == 50000
    assert body["type"] == "fact"


async def test_upsert_budget_idempotent(client, seeded_company, seeded_admin):
    url = f"/api/v1/companies/{seeded_company.id}/budgets"
    await client.put(url, json=_budget_payload(), headers=auth_headers(seeded_admin))
    await client.put(
        url, json=_budget_payload(marketing=120000), headers=auth_headers(seeded_admin)
    )

    res = await client.get(url, headers=auth_headers(seeded_admin))
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 1
    assert rows[0]["marketing"] == 120000


async def test_list_budgets_ordered(client, seeded_company, seeded_admin):
    url = f"/api/v1/companies/{seeded_company.id}/budgets"
    await client.put(
        url, json=_budget_payload(period="2026-02-01"), headers=auth_headers(seeded_admin)
    )
    await client.put(
        url, json=_budget_payload(period="2026-01-01"), headers=auth_headers(seeded_admin)
    )

    res = await client.get(url, headers=auth_headers(seeded_admin))
    rows = res.json()
    assert [r["period"] for r in rows] == ["2026-02-01", "2026-01-01"]


async def test_upsert_budget_invalid_type(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/budgets",
        json=_budget_payload(type_="bogus"),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422


async def test_upsert_budget_negative_article(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/budgets",
        json=_budget_payload(marketing=-5),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422


async def test_upsert_budget_forbidden_observer(client, seeded_company, seeded_observer):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/budgets",
        json=_budget_payload(),
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403
