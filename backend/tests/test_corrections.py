"""E28: Fund corrections are immutable review overlays, never source mutations."""

from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import select

from app.models.comment import Comment
from app.models.correction import Correction
from app.models.budget import Budget
from app.models.metric import Metric
from app.models.organization import Organization
from app.services.metric_service import MetricService
from app.schemas.metric import MetricUpsert

from .conftest import auth_headers, make_user


def metric(company_id, kind="fact", revenue=100):
    return Metric(
        company_id=company_id,
        period=date(2026, 1, 1),
        type=kind,
        new_units=10,
        arpu=10,
        revenue=revenue,
        marketing_spend=20,
        retention_rate=0.9,
        churn=0.1,
        cac=2,
        ltv=100,
    )


async def post_metric(
    client, company_id, user, metric_id, field="revenue", value="95", reason=" Review "
):
    return await client.post(
        f"/api/v1/companies/{company_id}/corrections",
        headers=auth_headers(user),
        json={
            "target_type": "metric_value",
            "metric_id": str(metric_id),
            "field": field,
            "corrected_value": value,
            "reason": reason,
        },
    )


async def test_metric_snapshot_history_stale_and_canonical_source(
    client, db_session, seeded_admin, seeded_company, seeded_company_user
):
    source = metric(seeded_company.id)
    db_session.add(source)
    await db_session.flush()
    path = f"/api/v1/companies/{seeded_company.id}/corrections"
    first = await post_metric(client, seeded_company.id, seeded_admin, source.id)
    assert first.status_code == 201, first.text
    assert Decimal(first.json()["original_value"]) == 100
    assert Decimal(first.json()["corrected_value"]) == 95
    assert first.json()["reason"] == "Review"
    assert first.json()["is_stale"] is False
    assert source.revenue == 100

    # A comment and a correction on the same value remain independent.
    comment = await client.post(
        path.replace("corrections", "comments"),
        headers=auth_headers(seeded_admin),
        json={
            "target_type": "metric_value",
            "metric_id": str(source.id),
            "field": "revenue",
            "text": "Note",
        },
    )
    assert comment.status_code == 201
    assert (await db_session.scalars(select(Comment))).one().text == "Note"

    await MetricService(db_session).upsert_metric(
        seeded_company.id,
        MetricUpsert(
            period=date(2026, 1, 1),
            type="fact",
            new_units=10,
            arpu=10,
            revenue=120,
            marketing_spend=20,
            retention_rate=0.9,
        ),
    )
    old = await client.get(
        path,
        headers=auth_headers(seeded_company_user),
        params={"target_type": "metric_value", "metric_id": str(source.id)},
    )
    assert old.status_code == 200
    assert old.json()[0]["is_stale"] is True
    assert Decimal(old.json()[0]["current_source_value"]) == 120
    second = await post_metric(
        client,
        seeded_company.id,
        seeded_admin,
        source.id,
        value="115",
        reason="New review",
    )
    assert second.status_code == 201
    assert Decimal(second.json()["original_value"]) == 120
    rows = (
        await client.get(
            path,
            headers=auth_headers(seeded_admin),
            params={"target_type": "metric_value", "metric_id": str(source.id)},
        )
    ).json()
    assert [(r["is_stale"], r["reason"]) for r in rows] == [
        (True, "Review"),
        (False, "New review"),
    ]
    assert source.revenue == 120
    assert (
        await client.patch(
            path + "/" + rows[0]["id"], headers=auth_headers(seeded_admin), json={}
        )
    ).status_code == 404


async def test_metric_plan_fact_field_validation_and_delete(
    client, db_session, seeded_admin, seeded_company, seeded_company_user
):
    plan, fact = metric(seeded_company.id, "plan", 110), metric(seeded_company.id)
    db_session.add_all((plan, fact))
    await db_session.flush()
    for source, field, value in (
        (plan, "revenue", "111"),
        (fact, "revenue", "101"),
        (fact, "new_units", "9"),
    ):
        result = await post_metric(
            client, seeded_company.id, seeded_admin, source.id, field, value
        )
        assert result.status_code == 201, result.text
    for field, value in (
        ("id", "1"),
        ("comment", "1"),
        ("new_units", "1.5"),
        ("retention_rate", "1.1"),
        ("revenue", "-1"),
        ("arpu", "0"),
    ):
        assert (
            await post_metric(
                client, seeded_company.id, seeded_admin, fact.id, field, value
            )
        ).status_code == 422
    assert (
        await post_metric(client, seeded_company.id, seeded_admin, uuid4())
    ).status_code == 404
    assert (
        await post_metric(
            client, seeded_company.id, seeded_admin, fact.id, reason="   "
        )
    ).status_code == 422
    assert (
        await post_metric(
            client, seeded_company.id, seeded_admin, fact.id, reason="x" * 3001
        )
    ).status_code == 422
    path = f"/api/v1/companies/{seeded_company.id}/corrections"
    rows = (
        await client.get(
            path,
            headers=auth_headers(seeded_admin),
            params={"target_type": "metric_value"},
        )
    ).json()
    assert {(r["metric_id"], r["field"]) for r in rows} == {
        (str(plan.id), "revenue"),
        (str(fact.id), "revenue"),
        (str(fact.id), "new_units"),
    }
    assert (
        await client.delete(
            f"/api/v1/companies/{seeded_company.id}/metrics/{plan.id}",
            headers=auth_headers(seeded_company_user),
        )
    ).status_code == 200
    assert len((await db_session.scalars(select(Correction))).all()) == 2


async def test_ue_snapshot_context_stale_and_financial_invariance(
    client, db_session, seeded_admin, seeded_company, seeded_company_user
):
    source = metric(seeded_company.id)
    db_session.add(source)
    db_session.add(
        Budget(
            company_id=seeded_company.id,
            period=date(2026, 1, 1),
            type="fact",
            cogs=20,
            marketing=10,
            development=10,
            fot=10,
            gna=10,
        )
    )
    await db_session.flush()
    fund = auth_headers(seeded_admin)
    company = seeded_company.id
    ue_path = f"/api/v1/companies/{company}/unit-economics"
    dashboard_path = "/api/v1/dashboard"
    pnl_path = f"/api/v1/companies/{company}/pnl"
    before_ue = (await client.get(ue_path, headers=fund)).json()
    before_dashboard = await client.get(dashboard_path, headers=fund)
    before_pnl = await client.get(pnl_path, headers=fund)
    assert before_ue["gross_margin"] is not None
    assert before_dashboard.status_code == 200, before_dashboard.text
    assert before_pnl.status_code == 200, before_pnl.text
    path = f"/api/v1/companies/{company}/corrections"
    payload = {
        "target_type": "unit_economics",
        "indicator_key": "ltv_cac",
        "target_period": "2026-01-01",
        "target_scenario": "fact",
        "corrected_value": "40.5",
        "reason": "Review ratio",
    }
    created = await client.post(path, headers=fund, json=payload)
    assert created.status_code == 201, created.text
    assert Decimal(created.json()["original_value"]) == Decimal(
        str(before_ue["ltv_cac"])
    )
    assert created.json()["source_metric_id"] == str(source.id)
    assert (await client.get(ue_path, headers=fund)).json() == before_ue
    assert (
        await client.get(dashboard_path, headers=fund)
    ).json() == before_dashboard.json()
    assert (await client.get(pnl_path, headers=fund)).json() == before_pnl.json()
    assert (
        await client.post(
            path, headers=fund, json={**payload, "indicator_key": "missing"}
        )
    ).status_code == 422
    assert (
        await client.post(
            path, headers=fund, json={**payload, "target_period": "2026-02-01"}
        )
    ).status_code == 409
    # Changing the startup-owned Metric changes the canonical derived ratio, not the correction.
    await MetricService(db_session).upsert_metric(
        company,
        MetricUpsert(
            period=date(2026, 1, 1),
            type="fact",
            new_units=10,
            arpu=20,
            revenue=100,
            marketing_spend=20,
            retention_rate=0.9,
        ),
    )
    changed = (
        await client.get(
            path,
            headers=auth_headers(seeded_company_user),
            params={"target_type": "unit_economics"},
        )
    ).json()
    assert len(changed) == 1 and changed[0]["is_stale"] is True
    assert changed[0]["corrected_value"] == created.json()["corrected_value"]


async def test_permissions_tenants_and_foreign_metric(
    client,
    db_session,
    seeded_admin,
    seeded_observer,
    seeded_company,
    seeded_company_user,
    other_company,
):
    own = metric(seeded_company.id)
    foreign = metric(other_company.id)
    db_session.add_all((own, foreign))
    await db_session.flush()
    path = f"/api/v1/companies/{seeded_company.id}/corrections"
    for user in (seeded_company_user, seeded_observer):
        assert (
            await post_metric(client, seeded_company.id, user, own.id)
        ).status_code == 403
    assert (
        await client.get(
            path,
            headers=auth_headers(seeded_company_user),
            params={"target_type": "metric_value"},
        )
    ).status_code == 200
    assert (
        await client.get(
            path,
            headers=auth_headers(seeded_observer),
            params={"target_type": "metric_value"},
        )
    ).status_code == 403
    assert (
        await post_metric(client, seeded_company.id, seeded_admin, foreign.id)
    ).status_code == 404
    foreign_path = f"/api/v1/companies/{other_company.id}/corrections"
    assert (
        await client.get(
            foreign_path,
            headers=auth_headers(seeded_admin),
            params={"target_type": "metric_value"},
        )
    ).status_code == 403
    assert (
        await client.post(
            foreign_path,
            headers=auth_headers(seeded_admin),
            json={
                "target_type": "metric_value",
                "metric_id": str(foreign.id),
                "field": "revenue",
                "corrected_value": "1",
                "reason": "No",
            },
        )
    ).status_code == 403
    startup_org = Organization(name="Another startup", organization_type="startup")
    db_session.add(startup_org)
    await db_session.flush()
    from app.models.company import Company

    a = Company(name="A", organization_id=startup_org.id)
    b = Company(name="B", organization_id=startup_org.id)
    db_session.add_all((a, b))
    await db_session.flush()
    bound = await make_user(
        db_session, "bound@startup.ru", "admin", startup_org.id, a.id
    )
    assert (
        await client.get(
            f"/api/v1/companies/{b.id}/corrections",
            headers=auth_headers(bound),
            params={"target_type": "metric_value"},
        )
    ).status_code == 403
