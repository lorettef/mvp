from datetime import date

from sqlalchemy import select, func

from .conftest import auth_headers, make_user
from app.models.metric import Metric
from app.models.cohort import Cohort
from app.models.budget import Budget
from app.models.task import Task
from app.models.user import User


def _metric(company_id, period=date(2026, 1, 1), revenue=100.0) -> Metric:
    return Metric(
        company_id=company_id,
        period=period,
        type="fact",
        revenue=revenue,
        churn=0.1,
        ltv=100.0,
        cac=10.0,
    )


async def test_create_company_with_business_model(client, seeded_organization, seeded_admin):
    res = await client.post(
        "/api/v1/companies",
        json={"name": "BizCo", "industry": "SaaS", "business_model": "SaaS"},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["business_model"] == "SaaS"
    assert body["archived_at"] is None


async def test_archive_hides_from_active_and_shows_in_archived(client, seeded_company, seeded_admin):
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/archive",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.json()["archived_at"] is not None

    active = await client.get("/api/v1/companies", headers=auth_headers(seeded_admin))
    assert active.status_code == 200
    assert str(seeded_company.id) not in [c["id"] for c in active.json()]

    archived = await client.get(
        "/api/v1/companies?archived=true", headers=auth_headers(seeded_admin)
    )
    assert archived.status_code == 200
    assert str(seeded_company.id) in [c["id"] for c in archived.json()]


async def test_restore_returns_to_active(client, seeded_company, seeded_admin):
    await client.post(
        f"/api/v1/companies/{seeded_company.id}/archive",
        headers=auth_headers(seeded_admin),
    )
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/restore",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert res.json()["archived_at"] is None

    active = await client.get("/api/v1/companies", headers=auth_headers(seeded_admin))
    assert str(seeded_company.id) in [c["id"] for c in active.json()]


async def test_delete_company_cascades(db_session, client, seeded_company, seeded_admin):
    cid = seeded_company.id

    db_session.add(_metric(cid, date(2026, 1, 1)))
    db_session.add(
        Cohort(company_id=cid, period=date(2026, 1, 1), type="fact", size=1)
    )
    db_session.add(
        Budget(
            company_id=cid,
            period=date(2026, 1, 1),
            type="fact",
            marketing=1,
            development=1,
            fot=1,
            gna=1,
        )
    )
    db_session.add(
        Task(company_id=cid, title="Prepare metrics", stage="metrics", status="pending")
    )
    company_user = await make_user(
        db_session, "cu@test.ru", "company", seeded_company.organization_id, cid
    )
    await db_session.flush()

    res = await client.delete(
        f"/api/v1/companies/{cid}", headers=auth_headers(seeded_admin)
    )
    assert res.status_code == 200

    for model in (Metric, Cohort, Budget, Task):
        cnt = await db_session.scalar(
            select(func.count(model.id)).where(model.company_id == cid)
        )
        assert cnt == 0

    await db_session.refresh(company_user)
    assert company_user.company_id is None


async def test_delete_metric_removes_only_that_metric(
    db_session, client, seeded_company, seeded_admin, other_company
):
    m1 = _metric(seeded_company.id, date(2026, 1, 1), revenue=100.0)
    m2 = _metric(seeded_company.id, date(2026, 2, 1), revenue=200.0)
    m_other = _metric(other_company.id, date(2026, 1, 1), revenue=300.0)
    db_session.add_all([m1, m2, m_other])
    await db_session.flush()

    res = await client.delete(
        f"/api/v1/companies/{seeded_company.id}/metrics/{m1.id}",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200

    assert await db_session.get(Metric, m1.id) is None
    assert await db_session.get(Metric, m2.id) is not None
    assert await db_session.get(Metric, m_other.id) is not None

    # чужая метрика → 404
    res = await client.delete(
        f"/api/v1/companies/{seeded_company.id}/metrics/{m_other.id}",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 404


async def test_non_admin_archive_forbidden(
    client, seeded_company, seeded_company_user, seeded_observer
):
    for user in (seeded_company_user, seeded_observer):
        res = await client.post(
            f"/api/v1/companies/{seeded_company.id}/archive",
            headers=auth_headers(user),
        )
        assert res.status_code == 403


async def test_observer_delete_metric_forbidden(
    db_session, client, seeded_company, seeded_observer
):
    m = _metric(seeded_company.id)
    db_session.add(m)
    await db_session.flush()

    res = await client.delete(
        f"/api/v1/companies/{seeded_company.id}/metrics/{m.id}",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403
