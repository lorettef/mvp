from .conftest import auth_headers, make_user


async def test_plans_list(client, seeded_admin):
    res = await client.get(
        "/api/v1/subscription/plans",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    plans = res.json()
    assert len(plans) == 4
    ids = [p["id"] for p in plans]
    assert ids == ["starter", "pro", "business", "enterprise"]

    starter = plans[0]
    assert starter["price"] == 0
    assert starter["company_limit"] == 2
    assert starter["ai_reports_limit"] == 1

    business = plans[2]
    assert business["price"] == 39000
    assert business["company_limit"] == 25


async def test_plans_unauthenticated(client):
    res = await client.get("/api/v1/subscription/plans")
    assert res.status_code == 401


async def test_company_limit_enforced(
    client, seeded_admin, seeded_company, seeded_organization, db_session
):
    seeded_organization.organization_type = "startup"
    seeded_admin.company_id = None
    # в организации уже 1 компания (seeded_company), starter limit = 2
    res = await client.post(
        "/api/v1/companies",
        json={"name": "Вторая компания"},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 201
    assert str(seeded_admin.company_id) == res.json()["id"]
    another_owner = await make_user(
        db_session, "another-owner@plans.test", "admin", seeded_organization.id
    )

    res = await client.post(
        "/api/v1/companies",
        json={"name": "Третья компания"},
        headers=auth_headers(another_owner),
    )
    assert res.status_code == 403

    assert "Превышен лимит компаний" in res.json()["detail"]
