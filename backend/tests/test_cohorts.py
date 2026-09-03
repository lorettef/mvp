from app.models.company import Company

from .conftest import auth_headers


def _cohort_payload(
    period="2026-01-01",
    type_="plan",
    size=45,
    m1=0.8,
    m3=0.6,
    m6=0.4,
    m12=0.2,
):
    return {
        "period": period,
        "type": type_,
        "size": size,
        "retention_m1": m1,
        "retention_m2": 0.75,
        "retention_m3": m3,
        "retention_m4": 0.55,
        "retention_m5": 0.5,
        "retention_m6": m6,
        "retention_m7": 0.35,
        "retention_m8": 0.3,
        "retention_m9": 0.28,
        "retention_m10": 0.25,
        "retention_m11": 0.22,
        "retention_m12": m12,
        "marketing_spend": 5000.0,
    }


async def test_upsert_cohort_creates(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/cohorts",
        json=_cohort_payload(),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["retention_m1"] == 0.8
    assert body["retention_m12"] == 0.2
    assert body["size"] == 45
    assert body["marketing_spend"] == 5000.0
    assert body["type"] == "plan"
    assert body["period"] == "2026-01-01"


async def test_upsert_cohort_idempotent(client, seeded_company, seeded_admin):
    url = f"/api/v1/companies/{seeded_company.id}/cohorts"
    await client.put(url, json=_cohort_payload(), headers=auth_headers(seeded_admin))
    await client.put(
        url, json=_cohort_payload(m1=0.9), headers=auth_headers(seeded_admin)
    )

    res = await client.get(url, headers=auth_headers(seeded_admin))
    assert res.status_code == 200
    rows = res.json()
    assert len(rows) == 1
    assert rows[0]["retention_m1"] == 0.9


async def test_list_cohorts_ordered(client, seeded_company, seeded_admin):
    url = f"/api/v1/companies/{seeded_company.id}/cohorts"
    await client.put(
        url, json=_cohort_payload(period="2026-02-01"), headers=auth_headers(seeded_admin)
    )
    await client.put(
        url, json=_cohort_payload(period="2026-01-01"), headers=auth_headers(seeded_admin)
    )

    res = await client.get(url, headers=auth_headers(seeded_admin))
    rows = res.json()
    assert [r["period"] for r in rows] == ["2026-02-01", "2026-01-01"]


async def test_upsert_cohort_invalid_type(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/cohorts",
        json=_cohort_payload(type_="bogus"),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422


async def test_upsert_cohort_invalid_retention(client, seeded_company, seeded_admin):
    url = f"/api/v1/companies/{seeded_company.id}/cohorts"
    res = await client.put(
        url, json=_cohort_payload(m1=1.5), headers=auth_headers(seeded_admin)
    )
    assert res.status_code == 422

    res = await client.put(
        url, json=_cohort_payload(m1=-0.1), headers=auth_headers(seeded_admin)
    )
    assert res.status_code == 422


async def test_upsert_cohort_invalid_size(client, seeded_company, seeded_admin):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/cohorts",
        json=_cohort_payload(size=0),
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 422


async def test_upsert_cohort_forbidden_observer(client, seeded_company, seeded_observer):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/cohorts",
        json=_cohort_payload(),
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403


async def test_list_cohorts_company_isolation(
    client, seeded_company, seeded_admin, db_session
):
    url_a = f"/api/v1/companies/{seeded_company.id}/cohorts"
    await client.put(
        url_a, json=_cohort_payload(), headers=auth_headers(seeded_admin)
    )

    other = Company(
        organization_id=seeded_company.organization_id,
        name="Other Startup",
    )
    db_session.add(other)
    await db_session.flush()

    res = await client.get(
        f"/api/v1/companies/{other.id}/cohorts",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.json() == []


async def test_delete_cohort_removes_only_that(client, seeded_company, seeded_admin):
    url = f"/api/v1/companies/{seeded_company.id}/cohorts"
    r1 = await client.put(
        url, json=_cohort_payload(period="2026-01-01"), headers=auth_headers(seeded_admin)
    )
    r2 = await client.put(
        url, json=_cohort_payload(period="2026-02-01"), headers=auth_headers(seeded_admin)
    )
    id1 = r1.json()["id"]
    id2 = r2.json()["id"]

    res = await client.delete(f"{url}/{id1}", headers=auth_headers(seeded_admin))
    assert res.status_code == 200

    listing = await client.get(url, headers=auth_headers(seeded_admin))
    ids = [row["id"] for row in listing.json()]
    assert id1 not in ids
    assert id2 in ids


async def test_delete_cohort_wrong_company_404(
    client, seeded_company, seeded_admin, db_session
):
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/cohorts",
        json=_cohort_payload(),
        headers=auth_headers(seeded_admin),
    )
    cohort_id = res.json()["id"]

    other = Company(
        organization_id=seeded_company.organization_id,
        name="Other Startup",
    )
    db_session.add(other)
    await db_session.flush()

    res = await client.delete(
        f"/api/v1/companies/{other.id}/cohorts/{cohort_id}",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 404


async def test_delete_cohort_forbidden_observer(
    client, seeded_company, seeded_admin, seeded_observer
):
    url = f"/api/v1/companies/{seeded_company.id}/cohorts"
    res = await client.put(
        url, json=_cohort_payload(), headers=auth_headers(seeded_admin)
    )
    cohort_id = res.json()["id"]

    res = await client.delete(f"{url}/{cohort_id}", headers=auth_headers(seeded_observer))
    assert res.status_code == 403
