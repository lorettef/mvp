from .conftest import auth_headers


async def test_metrics_analyze_authenticated(client, seeded_admin):
    res = await client.post(
        "/api/v1/metrics/analyze",
        json={
            "mrr": 50000,
            "cac": 5000,
            "ltv": 15000,
            "churn": 0.05,
            "arpu": 1500,
            "runway_months": 18,
            "stage": "pre_seed",
        },
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["ltv_cac_ratio"] == 3.0
    assert body["alerts"]


async def test_metrics_analyze_unauthenticated(client):
    res = await client.post(
        "/api/v1/metrics/analyze",
        json={
            "mrr": 50000,
            "cac": 5000,
            "ltv": 15000,
            "churn": 0.05,
            "arpu": 1500,
            "runway_months": 18,
            "stage": "pre_seed",
        },
    )
    assert res.status_code == 401
