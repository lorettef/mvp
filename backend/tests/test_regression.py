from app.models.company import Company

from .conftest import auth_headers


async def test_health(client):
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_metrics_unauthenticated_401(client, seeded_company):
    res = await client.get(f"/api/v1/companies/{seeded_company.id}/metrics")
    assert res.status_code == 401


async def test_metrics_admin_200(client, seeded_company, seeded_admin):
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.json() == []


async def test_metrics_company_isolation_403(
    client, seeded_company, seeded_company_user, db_session
):
    other = Company(
        organization_id=seeded_company.organization_id,
        name="Other Startup",
    )
    db_session.add(other)
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{other.id}/metrics",
        headers=auth_headers(seeded_company_user),
    )
    assert res.status_code == 403
