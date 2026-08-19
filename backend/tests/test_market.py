import pytest

from .conftest import auth_headers


async def test_market_analysis_saas_ru(client, seeded_admin):
    res = await client.post(
        "/api/v1/market/analyze",
        json={"industry": "saas", "geography": "RU", "horizon": 3},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["industry"] == "saas"
    assert body["industry_label"] == "SaaS"
    assert body["geography"] == "RU"
    assert body["macro"]["gdp_growth"] == 3.5
    assert body["macro"]["inflation"] == 8.5
    assert body["macro"]["key_rate"] == 21.0
    assert body["market_size"] == 300.0
    assert body["market_size_projected"] == pytest.approx(456.3, abs=0.1)
    assert body["market_growth"] == 15.0
    assert len(body["trends"]) == 3
    assert body["impact"]["mrr_factor"] > 1
    assert body["impact"]["cac_factor"] > 1
    assert body["impact"]["churn_factor"] > 1
    assert "SaaS" in body["summary"]


async def test_market_fintech_kz(client, seeded_admin):
    res = await client.post(
        "/api/v1/market/analyze",
        json={"industry": "fintech", "geography": "KZ", "horizon": 2},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["industry_label"] == "Fintech"
    assert body["geography_label"] == "Казахстан"
    assert body["market_size"] == pytest.approx(36.0, abs=0.01)  # 450 * 0.08
    assert body["macro"]["key_rate"] == 16.0
    assert body["macro"]["inflation"] == 8.0


async def test_market_global_scale(client, seeded_admin):
    res = await client.post(
        "/api/v1/market/analyze",
        json={"industry": "saas", "geography": "global", "horizon": 1},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["market_size"] == pytest.approx(7500.0, abs=0.1)  # 300 * 25


async def test_market_invalid_horizon(client, seeded_admin):
    for h in (0, 4, 10):
        res = await client.post(
            "/api/v1/market/analyze",
            json={"industry": "saas", "geography": "RU", "horizon": h},
            headers=auth_headers(seeded_admin),
        )
        assert res.status_code == 422


async def test_market_invalid_industry_geography(client, seeded_admin):
    res = await client.post(
        "/api/v1/market/analyze",
        json={"industry": "bogus", "geography": "RU", "horizon": 3},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422
    res = await client.post(
        "/api/v1/market/analyze",
        json={"industry": "saas", "geography": "bogus", "horizon": 3},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422


async def test_market_defaults(client, seeded_admin):
    res = await client.post(
        "/api/v1/market/analyze", json={}, headers=auth_headers(seeded_admin)
    )
    assert res.status_code == 200
    assert res.json()["industry"] == "saas"
    assert res.json()["horizon"] == 3


async def test_market_unauthenticated(client):
    res = await client.post(
        "/api/v1/market/analyze",
        json={"industry": "saas", "geography": "RU", "horizon": 3},
    )
    assert res.status_code == 401
