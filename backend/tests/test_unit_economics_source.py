import pytest
from sqlalchemy import func, select

from app.models.metric import Metric
from app.services.unit_economics_service import UnitEconomicsService
from .conftest import auth_headers


def raw(period="2026-02-01", type_="fact", **changes):
    return {
        "period": period,
        "type": type_,
        "new_units": 10,
        "arpu": 100,
        "revenue": 1000,
        "marketing_spend": 200,
        "retention_rate": 0.9,
        "comment": "Keep this comment",
        **changes,
    }


async def put(client, company, user, data):
    response = await client.put(
        f"/api/v1/companies/{company.id}/metrics",
        headers=auth_headers(user),
        json=data,
    )
    assert response.status_code == 200, response.text
    return response.json()


async def summary(client, company, user):
    response = await client.get(
        f"/api/v1/companies/{company.id}/unit-economics",
        headers=auth_headers(user),
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_source_is_latest_fact_with_exact_raw_inputs(
    client, seeded_company, seeded_admin, db_session
):
    await put(client, seeded_company, seeded_admin, raw("2026-01-01"))
    data = raw(
        new_units=45, arpu=95, revenue=4275, marketing_spend=14400, retention_rate=0.82
    )
    latest = await put(client, seeded_company, seeded_admin, data)
    await put(client, seeded_company, seeded_admin, raw("2026-12-01", "plan"))
    body = await summary(client, seeded_company, seeded_admin)
    assert body["source_metric"] == {"id": latest["id"], **data}
    assert body["cac"] == 320
    assert body["ltv"] == 527.78
    assert body["churn"] == 0.18
    assert body["ltv_cac"] == 1.65

    # Batch callers must expose precisely the same source as the normal query.
    metrics = list(
        (
            await db_session.execute(select(Metric).order_by(Metric.period.desc()))
        ).scalars()
    )
    prefetched = {
        (seeded_company.id, kind): [m for m in metrics if m.type == kind]
        for kind in ("fact", "plan")
    }
    batch = await UnitEconomicsService(db_session).get_unit_economics(
        seeded_company.id, prefetched_metrics=prefetched
    )
    assert batch.model_dump(mode="json") == body


async def test_plan_fallback_and_empty_source(
    client, seeded_company, seeded_admin, db_session
):
    assert (await summary(client, seeded_company, seeded_admin))[
        "source_metric"
    ] is None
    await put(client, seeded_company, seeded_admin, raw("2026-01-01", "plan"))
    data = raw("2026-02-01", "plan")
    latest = await put(client, seeded_company, seeded_admin, data)
    body = await summary(client, seeded_company, seeded_admin)
    assert body["source_metric"] == {"id": latest["id"], **data}
    metrics = list(
        (
            await db_session.execute(select(Metric).order_by(Metric.period.desc()))
        ).scalars()
    )
    batch = await UnitEconomicsService(db_session).get_unit_economics(
        seeded_company.id, prefetched_metrics={(seeded_company.id, "plan"): metrics}
    )
    assert batch.model_dump(mode="json") == body


async def test_edit_recalculates_derived_values_on_same_record(
    client, seeded_company, seeded_admin, db_session
):
    first = await put(client, seeded_company, seeded_admin, raw())
    before = await summary(client, seeded_company, seeded_admin)
    assert (before["cac"], before["ltv"], before["churn"], before["ltv_cac"]) == (
        20,
        1000,
        0.1,
        50,
    )

    data = raw(
        new_units=20, arpu=300, revenue=6000, marketing_spend=1000, retention_rate=0.8
    )
    updated = await put(client, seeded_company, seeded_admin, data)
    assert updated["id"] == first["id"]
    count = await db_session.scalar(
        select(func.count())
        .select_from(Metric)
        .where(Metric.company_id == seeded_company.id)
    )
    assert count == 1
    body = await summary(client, seeded_company, seeded_admin)
    assert body["source_metric"] == {"id": first["id"], **data}
    assert (body["cac"], body["ltv"], body["churn"], body["ltv_cac"]) == (
        50,
        1500,
        0.2,
        30,
    )
    assert body["revenue"] == 6000
    assert body["payback_period"] == pytest.approx(0.22)
    assert body["romi"] == 29


async def test_delete_reselects_previous_fact_then_plan_then_empty(
    client, seeded_company, seeded_admin
):
    plan = await put(client, seeded_company, seeded_admin, raw("2026-03-01", "plan"))
    previous = await put(client, seeded_company, seeded_admin, raw("2026-01-01"))
    latest = await put(client, seeded_company, seeded_admin, raw())
    for deleted, expected in [(latest, previous), (previous, plan), (plan, None)]:
        response = await client.delete(
            f"/api/v1/companies/{seeded_company.id}/metrics/{deleted['id']}",
            headers=auth_headers(seeded_admin),
        )
        assert response.status_code == 200
        body = await summary(client, seeded_company, seeded_admin)
        if expected is None:
            assert body["source_metric"] is None
            assert body["ltv_cac"] is None
        else:
            assert body["source_metric"]["id"] == expected["id"]
            assert body["source_metric"]["type"] == expected["type"]


async def test_source_read_only_and_tenant_access(
    client,
    seeded_company,
    seeded_admin,
    seeded_observer,
    seeded_company_user,
    other_admin,
):
    metric = await put(client, seeded_company, seeded_admin, raw())
    assert (await summary(client, seeded_company, seeded_observer))["source_metric"][
        "id"
    ] == metric["id"]
    await put(client, seeded_company, seeded_company_user, raw(arpu=120))
    response = await client.put(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        headers=auth_headers(seeded_observer),
        json=raw(),
    )
    assert response.status_code == 403
    response = await client.delete(
        f"/api/v1/companies/{seeded_company.id}/metrics/{metric['id']}",
        headers=auth_headers(seeded_observer),
    )
    assert response.status_code == 403
    response = await client.get(
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        headers=auth_headers(other_admin),
    )
    assert response.status_code == 403
