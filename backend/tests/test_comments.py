"""E27: immutable review metadata and strict company/product-role boundaries."""

from datetime import date
from uuid import uuid4

from app.models.comment import Comment
from app.models.company import Company
from app.models.metric import Metric
from app.models.organization import Organization
from sqlalchemy import select

from .conftest import auth_headers, make_user


async def test_fund_overview_and_immutable_order(
    client, db_session, seeded_admin, seeded_company, seeded_company_user
):
    path = f"/api/v1/companies/{seeded_company.id}/comments"
    fund = auth_headers(seeded_admin)
    for text in ("  First review  ", "Second review"):
        created = await client.post(
            path, headers=fund, json={"target_type": "overview", "text": text}
        )
        assert created.status_code == 201, created.text
        assert created.json()["text"] == text.strip()
        assert created.json()["author_name"] == seeded_admin.full_name
    listed = await client.get(
        path,
        headers=auth_headers(seeded_company_user),
        params={"target_type": "overview"},
    )
    assert listed.status_code == 200
    assert [item["text"] for item in listed.json()] == ["First review", "Second review"]
    assert (
        await client.post(
            path,
            headers=auth_headers(seeded_company_user),
            json={"target_type": "overview", "text": "No"},
        )
    ).status_code == 403
    assert (
        await client.patch(
            path + "/" + listed.json()[0]["id"], headers=fund, json={"text": "edit"}
        )
    ).status_code == 404
    assert [
        item["text"]
        for item in (
            await client.get(path, headers=fund, params={"target_type": "overview"})
        ).json()
    ] == ["First review", "Second review"]


async def test_metric_target_separation_cascade_and_financial_immutability(
    client, db_session, seeded_admin, seeded_company, seeded_company_user
):
    metrics = [
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 1, 1),
            type=kind,
            new_units=10,
            arpu=100,
            revenue=value,
            marketing_spend=100,
            retention_rate=0.9,
            churn=0.1,
            ltv=1000,
            cac=10,
        )
        for kind, value in (("plan", 1000), ("fact", 1200))
    ]
    db_session.add_all(metrics)
    await db_session.flush()
    before = [(m.id, m.revenue, m.comment) for m in metrics]
    path = f"/api/v1/companies/{seeded_company.id}/comments"
    for metric, field in (
        (metrics[0], "revenue"),
        (metrics[1], "revenue"),
        (metrics[1], "new_units"),
    ):
        result = await client.post(
            path,
            headers=auth_headers(seeded_admin),
            json={
                "target_type": "metric_value",
                "metric_id": str(metric.id),
                "field": field,
                "text": "Review",
            },
        )
        assert result.status_code == 201, result.text
    listed = (
        await client.get(
            path,
            headers=auth_headers(seeded_company_user),
            params={"target_type": "metric_value"},
        )
    ).json()
    assert len(listed) == 3
    assert {(row["metric_id"], row["field"]) for row in listed} == {
        (str(metrics[0].id), "revenue"),
        (str(metrics[1].id), "revenue"),
        (str(metrics[1].id), "new_units"),
    }
    assert [(m.id, m.revenue, m.comment) for m in metrics] == before
    assert (
        await client.post(
            path,
            headers=auth_headers(seeded_admin),
            json={
                "target_type": "metric_value",
                "metric_id": str(uuid4()),
                "field": "revenue",
                "text": "Wrong",
            },
        )
    ).status_code == 404
    assert (
        await client.post(
            path,
            headers=auth_headers(seeded_admin),
            json={
                "target_type": "metric_value",
                "metric_id": str(metrics[0].id),
                "field": "id",
                "text": "Wrong",
            },
        )
    ).status_code == 422
    deleted = await client.delete(
        f"/api/v1/companies/{seeded_company.id}/metrics/{metrics[0].id}",
        headers=auth_headers(seeded_company_user),
    )
    assert deleted.status_code == 200
    rows = (
        (
            await db_session.execute(
                select(Comment).where(Comment.target_type == "metric_value")
            )
        )
        .scalars()
        .all()
    )
    assert len(rows) == 2 and all(row.metric_id == metrics[1].id for row in rows)


async def test_unit_context_validation_and_separation(
    client, seeded_admin, seeded_company
):
    path = f"/api/v1/companies/{seeded_company.id}/comments"
    for period in ("2026-01-01", "2026-02-01"):
        created = await client.post(
            path,
            headers=auth_headers(seeded_admin),
            json={
                "target_type": "unit_economics",
                "indicator_key": "ltv_cac",
                "target_period": period,
                "target_scenario": "fact",
                "text": period,
            },
        )
        assert created.status_code == 201, created.text
    rows = (
        await client.get(
            path,
            headers=auth_headers(seeded_admin),
            params={"target_type": "unit_economics"},
        )
    ).json()
    assert len(rows) == 2 and rows[0]["target_period"] != rows[1]["target_period"]
    january = (
        await client.get(
            path,
            headers=auth_headers(seeded_admin),
            params={
                "target_type": "unit_economics",
                "indicator_key": "ltv_cac",
                "target_period": "2026-01-01",
                "target_scenario": "fact",
            },
        )
    ).json()
    assert len(january) == 1 and january[0]["text"] == "2026-01-01"
    for body in (
        {"target_type": "unit_economics", "indicator_key": "unknown", "text": "Bad"},
        {
            "target_type": "unit_economics",
            "indicator_key": "ltv_cac",
            "target_scenario": "fact",
            "text": "Bad",
        },
        {"target_type": "overview", "text": "   "},
        {"target_type": "overview", "text": "x" * 3001},
    ):
        assert (
            await client.post(path, headers=auth_headers(seeded_admin), json=body)
        ).status_code == 422


async def test_comments_denied_to_investor_and_foreign_company(
    client, seeded_admin, seeded_observer, seeded_company, other_company
):
    own = f"/api/v1/companies/{seeded_company.id}/comments"
    foreign = f"/api/v1/companies/{other_company.id}/comments"
    for method, path, user in (
        ("GET", own, seeded_observer),
        ("POST", own, seeded_observer),
        ("GET", foreign, seeded_admin),
        ("POST", foreign, seeded_admin),
    ):
        response = await client.request(
            method,
            path,
            headers=auth_headers(user),
            params={"target_type": "overview"} if method == "GET" else None,
            json=(
                {"target_type": "overview", "text": "Review"}
                if method == "POST"
                else None
            ),
        )
        assert response.status_code == 403


async def test_startup_same_org_foreign_and_unknown_role_denied(client, db_session):
    org = Organization(name="Startup comments tenant", organization_type="startup")
    db_session.add(org)
    await db_session.flush()
    own = Company(name="Own", organization_id=org.id)
    sibling = Company(name="Sibling", organization_id=org.id)
    db_session.add_all([own, sibling])
    await db_session.flush()
    startup = await make_user(
        db_session, "own-comments@test.ru", "admin", org.id, own.id
    )
    unknown = await make_user(
        db_session, "unknown-comments@test.ru", "unknown", org.id, own.id
    )
    own_url = f"/api/v1/companies/{own.id}/comments"
    sibling_url = f"/api/v1/companies/{sibling.id}/comments"
    assert (
        await client.get(
            own_url, headers=auth_headers(startup), params={"target_type": "overview"}
        )
    ).status_code == 200
    for user, url in ((startup, sibling_url), (unknown, own_url)):
        assert (
            await client.get(
                url, headers=auth_headers(user), params={"target_type": "overview"}
            )
        ).status_code == 403
        assert (
            await client.post(
                url,
                headers=auth_headers(user),
                json={"target_type": "overview", "text": "No"},
            )
        ).status_code == 403


async def test_metric_from_another_company_in_same_tenant_is_rejected(
    client, db_session, seeded_admin, seeded_company, seeded_organization
):
    sibling = Company(name="Other company", organization_id=seeded_organization.id)
    db_session.add(sibling)
    await db_session.flush()
    metric = Metric(
        company_id=sibling.id,
        period=date(2026, 1, 1),
        type="fact",
        new_units=1,
        arpu=100,
        revenue=100,
        marketing_spend=10,
        retention_rate=0.9,
        churn=0.1,
        ltv=1000,
        cac=10,
    )
    db_session.add(metric)
    await db_session.flush()
    response = await client.post(
        f"/api/v1/companies/{seeded_company.id}/comments",
        headers=auth_headers(seeded_admin),
        json={
            "target_type": "metric_value",
            "metric_id": str(metric.id),
            "field": "revenue",
            "text": "No",
        },
    )
    assert response.status_code == 404


async def test_historical_author_remains_visible_after_organization_change(
    client,
    db_session,
    seeded_admin,
    seeded_company,
    seeded_company_user,
    other_organization,
):
    path = f"/api/v1/companies/{seeded_company.id}/comments"
    created = await client.post(
        path,
        headers=auth_headers(seeded_admin),
        json={"target_type": "overview", "text": "Historical review"},
    )
    assert created.status_code == 201
    seeded_admin.organization_id = other_organization.id
    await db_session.flush()
    listed = await client.get(
        path,
        headers=auth_headers(seeded_company_user),
        params={"target_type": "overview"},
    )
    assert listed.status_code == 200
    assert [item["text"] for item in listed.json()] == ["Historical review"]


async def test_comment_creation_does_not_change_financial_responses(
    client, db_session, seeded_admin, seeded_company
):
    db_session.add(
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 1, 1),
            type="fact",
            new_units=10,
            arpu=100,
            revenue=1000,
            marketing_spend=100,
            retention_rate=0.9,
            churn=0.1,
            ltv=1000,
            cac=10,
        )
    )
    await db_session.flush()
    headers = auth_headers(seeded_admin)
    urls = [
        f"/api/v1/companies/{seeded_company.id}/metrics",
        f"/api/v1/companies/{seeded_company.id}/unit-economics",
        f"/api/v1/companies/{seeded_company.id}/pnl",
        "/api/v1/dashboard",
    ]
    before = [(await client.get(url, headers=headers)).json() for url in urls]
    response = await client.post(
        f"/api/v1/companies/{seeded_company.id}/comments",
        headers=headers,
        json={"target_type": "overview", "text": "Review only"},
    )
    assert response.status_code == 201
    after = [(await client.get(url, headers=headers)).json() for url in urls]
    assert after == before
