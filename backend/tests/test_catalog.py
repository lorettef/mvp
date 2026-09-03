"""Tests for the GET /catalog endpoint."""

from .conftest import auth_headers


async def test_catalog_requires_auth(client):
    res = await client.get("/api/v1/catalog")
    assert res.status_code == 401


async def test_catalog_returns_catalog(client, seeded_admin):
    res = await client.get("/api/v1/catalog", headers=auth_headers(seeded_admin))
    assert res.status_code == 200

    body = res.json()
    assert "industries" in body
    assert "business_models" in body
    assert "profiles" in body

    subscription = body["profiles"]["saas"]["subscription"]
    metric_keys = [m["key"] for m in subscription["metrics"]]
    for key in ("new_units", "arpu", "revenue", "marketing_spend", "retention_rate"):
        assert key in metric_keys
