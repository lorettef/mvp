"""Filtered universe, historical snapshots and public query contract regressions."""

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import event

from app.models.budget import Budget
from app.models.company import Company
from app.models.financing import Financing
from app.models.metric import Metric
from app.schemas.dashboard import DashboardFilters
from app.services.dashboard_service import DashboardService
from .conftest import auth_headers, make_user


def metric(company, month, revenue, type_="fact", **values):
    return Metric(
        company_id=company.id,
        period=date(2026, month, 1),
        type=type_,
        revenue=revenue,
        cac=values.pop("cac", 10),
        ltv=values.pop("ltv", 100),
        churn=values.pop("churn", 0.05),
        **values,
    )


async def portfolio(db, org):
    companies = [
        Company(organization_id=org.id, name=name, industry=industry)
        for name, industry in [
            ("Healthy", "saas"),
            ("Attention", "fintech"),
            ("Critical", "saas"),
            ("No plan", "edtech"),
            ("No data", "saas"),
            ("Archived", "saas"),
        ]
    ]
    db.add_all(companies)
    await db.flush()
    healthy, attention, critical, no_plan, no_data, archived = companies
    archived.archived_at = datetime.now(timezone.utc)
    db.add_all(
        [
            metric(healthy, 1, 100, retention_rate=0.95),
            metric(
                healthy,
                2,
                120,
                new_units=12,
                arpu=10,
                marketing_spend=24,
                retention_rate=0.95,
            ),
            metric(healthy, 2, 110, "plan", new_units=11, arpu=10, marketing_spend=22),
            metric(attention, 1, 200),
            metric(attention, 2, 210),
            metric(attention, 2, 250, "plan"),
            metric(critical, 1, 300),
            metric(critical, 2, 310, churn=0.3),
            metric(critical, 2, 305, "plan"),
            metric(no_plan, 1, 400),
            metric(no_plan, 2, 420),
            # A plan with no Fact must not become a company snapshot plan.
            metric(no_data, 2, 500, "plan"),
            metric(archived, 2, 1000000),
            metric(archived, 2, 900000, "plan"),
        ]
    )
    await db.flush()
    return companies


@pytest.mark.parametrize(
    "kwargs,names",
    [
        ({"health": ["healthy"]}, ["Healthy", "No plan"]),
        ({"health": ["attention"]}, ["Attention"]),
        ({"health": ["critical"]}, ["Critical"]),
        ({"health": ["no_data"]}, ["No data"]),
        ({"performance_status": ["on_track"]}, ["Critical", "Healthy"]),
        ({"performance_status": ["behind"]}, ["Attention"]),
        ({"performance_status": ["no_plan"]}, ["No plan"]),
        ({"performance_status": ["no_data"]}, ["No data"]),
        ({"industries": ["fintech"]}, ["Attention"]),
        (
            {"industries": ["saas", "fintech"]},
            ["Attention", "Critical", "Healthy", "No data"],
        ),
        ({"industries": ["unknown"]}, []),
        (
            {
                "health": ["critical", "attention"],
                "performance_status": ["on_track", "behind"],
            },
            ["Attention", "Critical"],
        ),
        (
            {
                "industries": ["saas"],
                "period_from": date(2026, 2, 1),
                "period_to": date(2026, 2, 1),
            },
            ["Critical", "Healthy", "No data"],
        ),
    ],
)
async def test_filters_share_kpi_and_performance_universe(
    db_session, seeded_organization, kwargs, names
):
    await portfolio(db_session, seeded_organization)
    service = DashboardService(db_session)
    filters = DashboardFilters(**kwargs)
    dashboard = await service.get_dashboard(seeded_organization.id, filters)
    assert [item.name for item in dashboard.companies] == names
    assert dashboard.total_companies == len(names)
    # Independent fixture values for aggregate checks, including all KPI fields.
    expected = {
        "Healthy": (120, 100, "on_track", "healthy", 0.05),
        "Attention": (210, 200, "behind", "attention", 0.05),
        "Critical": (310, 300, "on_track", "critical", 0.3),
        "No plan": (420, 400, "no_plan", "healthy", 0.05),
    }
    data = [expected[name] for name in names if name in expected]
    total = sum(row[0] for row in data)
    previous = sum(row[1] for row in data)
    assert dashboard.portfolio_revenue == (total if data else None)
    assert dashboard.avg_revenue == (total / len(data) if data else None)
    assert dashboard.revenue_growth == (
        round((total - previous) / previous, 4) if data else None
    )
    assert dashboard.avg_cac == (10 if data else None)
    assert dashboard.avg_ltv == (100 if data else None)
    assert dashboard.avg_churn == (
        sum(row[4] for row in data) / len(data) if data else None
    )
    assert dashboard.avg_runway is None
    assert dashboard.companies_at_risk == sum(
        row[3] in ("attention", "critical") for row in data
    )
    assert dashboard.companies_without_data == int("No data" in names)
    for status in ("on_track", "behind", "no_plan"):
        assert getattr(dashboard, status) == sum(row[2] == status for row in data)
    assert dashboard.no_data == int("No data" in names)
    for item in dashboard.companies:
        if item.status == "no_data":
            assert item.fact is None and item.plan is None
        else:
            assert item.fact.revenue == item.latest_revenue
            if item.plan is not None:
                assert item.plan.period == item.fact.period
    points = await service.get_performance(seeded_organization.id, filters=filters)
    if names:
        february = next(point for point in points if point.month == "2026-02")
        assert february.fact == (total if data else None)
        plans = {"Healthy": 110, "Attention": 250, "Critical": 305, "No data": 500}
        selected_plans = [plans[name] for name in names if name in plans]
        assert february.plan == (sum(selected_plans) if selected_plans else None)
    else:
        assert points == []


@pytest.mark.parametrize(
    "selection,extra,names",
    [
        ([0], {}, ["Healthy"]),
        ([0, 1], {}, ["Attention", "Healthy"]),
        ([0, 1], {"industries": ["fintech"]}, ["Attention"]),
        ([0, 1, 2], {"health": ["critical"]}, ["Critical"]),
        ([5], {}, []),
    ],
)
async def test_company_selection_and_combinations(
    db_session, seeded_organization, selection, extra, names
):
    companies = await portfolio(db_session, seeded_organization)
    filters = DashboardFilters(
        company_ids=[companies[index].id for index in selection], **extra
    )
    dashboard = await DashboardService(db_session).get_dashboard(
        seeded_organization.id, filters
    )
    assert [item.name for item in dashboard.companies] == names


async def test_snapshots_and_dates(db_session, seeded_organization):
    healthy, *others = await portfolio(db_session, seeded_organization)
    service = DashboardService(db_session)
    filters = DashboardFilters(
        company_ids=[healthy.id],
        period_from=date(2026, 2, 1),
        period_to=date(2026, 2, 1),
    )
    response = await service.get_dashboard(seeded_organization.id, filters)
    item = response.companies[0]
    assert item.revenue_growth == 0.2  # January previous Fact is outside range.
    assert item.fact.model_dump() == {
        "period": date(2026, 2, 1),
        "revenue": 120,
        "new_units": 12,
        "arpu": 10,
        "marketing_spend": 24,
        "retention_rate": 0.95,
        "churn": 0.05,
        "ltv": 100,
        "cac": 10,
    }
    assert item.plan.period == item.fact.period
    assert item.plan.new_units == 11
    january = await service.get_dashboard(
        seeded_organization.id,
        DashboardFilters(company_ids=[healthy.id], period_to=date(2026, 1, 31)),
    )
    assert january.companies[0].latest_revenue == 100
    assert january.companies[0].fact.period == date(2026, 1, 1)
    assert (
        january.companies[0].plan is None
    )  # Future February Plan never matches January.
    assert january.companies[0].status == "no_plan"
    assert january.companies[0].revenue_growth is None
    missing = await service.get_dashboard(
        seeded_organization.id,
        DashboardFilters(period_from=date(2026, 3, 1), period_to=date(2026, 3, 31)),
    )
    assert missing.total_companies == missing.no_data == 5
    assert missing.portfolio_revenue is None
    assert all(
        item.fact is None and item.plan is None and item.health == "no_data"
        for item in missing.companies
    )
    lower_only = await service.get_dashboard(
        seeded_organization.id, DashboardFilters(period_from=date(2026, 3, 1))
    )
    assert lower_only.no_data == 5
    no_data_item = next(item for item in response.companies if item.name == "Healthy")
    assert no_data_item.latest_revenue == no_data_item.fact.revenue


@pytest.mark.parametrize("budget_type", ["fact", "plan"])
async def test_runway_cutoff_does_not_restart_at_lower_bound(
    db_session, seeded_organization, budget_type
):
    company = Company(organization_id=seeded_organization.id, name="Cash snapshot")
    db_session.add(company)
    await db_session.flush()
    db_session.add_all(
        [
            metric(company, 1, 100),
            metric(company, 2, 120),
            metric(company, 2, 110, "plan"),
            Budget(
                company_id=company.id,
                period=date(2026, 1, 1),
                type=budget_type,
                marketing=10,
                development=0,
                fot=0,
                gna=0,
            ),
            Budget(
                company_id=company.id,
                period=date(2026, 2, 1),
                type=budget_type,
                marketing=20,
                development=0,
                fot=0,
                gna=0,
            ),
            Financing(
                company_id=company.id,
                type="investment",
                amount=100,
                issued_date=date(2026, 1, 1),
            ),
            Financing(company_id=company.id, type="investment", amount=20),
        ]
    )
    await db_session.flush()
    service = DashboardService(db_session)
    filters = DashboardFilters(
        period_from=date(2026, 2, 1), period_to=date(2026, 2, 28)
    )
    before = await service.get_dashboard(seeded_organization.id, filters)
    expected_runway = (
        15.5 if budget_type == "fact" else 17.0
    )  # (funding + Jan+Feb profit) / Feb burn
    assert before.avg_runway == expected_runway
    assert before.companies[0].runway_months == expected_runway
    assert before.companies[0].health == "healthy"
    # Huge future actual/plan metrics, costs and funding must not affect as-of health or cash.
    db_session.add_all(
        [
            metric(company, 3, 900000, churn=0.9),
            metric(company, 3, 800000, "plan"),
            Budget(
                company_id=company.id,
                period=date(2026, 3, 1),
                type=budget_type,
                marketing=990000,
                development=0,
                fot=0,
                gna=0,
            ),
            Financing(
                company_id=company.id,
                type="loan",
                amount=1000000,
                issued_date=date(2026, 3, 1),
            ),
        ]
    )
    await db_session.flush()
    after = await service.get_dashboard(seeded_organization.id, filters)
    assert after.model_dump() == before.model_dump()
    if budget_type == "plan":
        # A future Fact budget must not displace the eligible legacy Plan budget.
        db_session.add(
            Budget(
                company_id=company.id,
                period=date(2026, 3, 1),
                type="fact",
                marketing=2000000,
                development=0,
                fot=0,
                gna=0,
            )
        )
        await db_session.flush()
        assert (
            await service.get_dashboard(seeded_organization.id, filters)
        ).model_dump() == before.model_dump()
    cutoff_only = await service.get_dashboard(
        seeded_organization.id, DashboardFilters(period_to=date(2026, 2, 28))
    )
    assert cutoff_only.model_dump() == before.model_dump()
    assert [
        point.month
        for point in await service.get_performance(
            seeded_organization.id, filters=filters
        )
    ] == ["2026-02"]
    unfiltered = await service.get_dashboard(seeded_organization.id)
    assert unfiltered.companies[0].fact.period == date(2026, 3, 1)
    assert unfiltered.companies[0].health == "critical"


async def test_performance_range_months_zero_and_missing(
    db_session, seeded_organization
):
    company = Company(organization_id=seeded_organization.id, name="Series")
    db_session.add(company)
    await db_session.flush()
    db_session.add_all([metric(company, month, month) for month in range(1, 10)])
    # October has a real zero Fact, November only a zero Plan; December is absent entirely.
    db_session.add_all([metric(company, 10, 0), metric(company, 11, 0, "plan")])
    await db_session.flush()
    service = DashboardService(db_session)
    legacy = await service.get_performance(seeded_organization.id)
    explicit_six = await service.get_performance(seeded_organization.id, 6)
    assert legacy == explicit_six
    assert [point.month for point in legacy] == [
        f"2026-{month:02}" for month in range(6, 12)
    ]
    filters = DashboardFilters(
        period_from=date(2026, 1, 1), period_to=date(2026, 11, 1)
    )
    points = await service.get_performance(seeded_organization.id, filters=filters)
    assert len(points) == 11  # No implicit six-period cap for explicit dates.
    assert points[-2].model_dump() == {"month": "2026-10", "fact": 0, "plan": None}
    assert points[-1].model_dump() == {"month": "2026-11", "fact": None, "plan": 0}
    capped = await service.get_performance(seeded_organization.id, 3, filters)
    assert capped == points[-3:]
    assert (
        await service.get_performance(
            seeded_organization.id,
            filters=DashboardFilters(period_from=date(2026, 12, 1)),
        )
        == []
    )


async def test_query_counts_are_bounded_for_both_endpoints(
    db_session, seeded_organization
):
    await portfolio(db_session, seeded_organization)
    db_session.add_all(
        [
            Company(organization_id=seeded_organization.id, name=f"Extra {i}")
            for i in range(30)
        ]
    )
    await db_session.flush()
    statements = []

    def count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db_session.bind.sync_engine
    event.listen(engine, "before_cursor_execute", count)
    try:
        service = DashboardService(db_session)
        filters = DashboardFilters(health=["healthy"], period_to=date(2026, 2, 1))
        await service.get_dashboard(seeded_organization.id, filters)
        assert len(statements) == 5
        statements.clear()
        await service.get_performance(seeded_organization.id, filters=filters)
        assert len(statements) == 4
    finally:
        event.remove(engine, "before_cursor_execute", count)


async def test_api_repeated_filters_and_backward_compatibility(
    client, db_session, seeded_organization
):
    healthy, attention, *_ = await portfolio(db_session, seeded_organization)
    admin = await make_user(
        db_session, "dashboard-admin@test.ru", "admin", seeded_organization.id
    )
    headers = auth_headers(admin)
    response = await client.get("/api/v1/dashboard", headers=headers)
    assert response.status_code == 200
    assert response.json()["total_companies"] == 5
    legacy = await client.get("/api/v1/dashboard/performance?months=6", headers=headers)
    default = await client.get("/api/v1/dashboard/performance", headers=headers)
    assert legacy.status_code == default.status_code == 200
    assert legacy.json() == default.json()
    params = [
        ("company_id", str(healthy.id)),
        ("company_id", str(attention.id)),
        ("industry", "saas"),
        ("industry", "fintech"),
        ("health", "healthy"),
        ("health", "attention"),
        ("performance_status", "on_track"),
        ("performance_status", "behind"),
        ("period_from", "2026-02-01"),
        ("period_to", "2026-02-01"),
    ]
    dashboard = await client.get("/api/v1/dashboard", params=params, headers=headers)
    assert dashboard.status_code == 200
    assert dashboard.json()["total_companies"] == 2
    assert dashboard.json()["portfolio_revenue"] == 330
    chart = await client.get(
        "/api/v1/dashboard/performance", params=params, headers=headers
    )
    assert chart.status_code == 200
    assert chart.json() == [{"month": "2026-02", "fact": 330, "plan": 360}]


@pytest.mark.parametrize("path", ["/api/v1/dashboard", "/api/v1/dashboard/performance"])
@pytest.mark.parametrize(
    "params",
    [
        {"period_from": "2026-03-01", "period_to": "2026-02-01"},
        {"period_to": "not-a-date"},
        {"company_id": "not-a-uuid"},
        {"health": "unknown"},
        {"performance_status": "archived"},
    ],
)
async def test_api_rejects_invalid_filters(client, seeded_admin, path, params):
    response = await client.get(path, params=params, headers=auth_headers(seeded_admin))
    assert response.status_code == 422


@pytest.mark.parametrize("months", [0, 25, "bad"])
async def test_api_months_validation(client, seeded_admin, months):
    response = await client.get(
        "/api/v1/dashboard/performance",
        params={"months": months},
        headers=auth_headers(seeded_admin),
    )
    assert response.status_code == 422


async def test_filter_model_rejects_inverted_range():
    with pytest.raises(ValidationError, match="period_from"):
        DashboardFilters(period_from=date(2026, 3, 1), period_to=date(2026, 2, 1))


@pytest.mark.parametrize(
    "endpoint", ["/api/v1/dashboard", "/api/v1/dashboard/performance"]
)
async def test_tenant_isolation_unknown_and_foreign_ids(
    client, db_session, seeded_organization, other_company, endpoint
):
    healthy, *_ = await portfolio(db_session, seeded_organization)
    admin = await make_user(
        db_session, "isolated-admin@test.ru", "admin", seeded_organization.id
    )
    db_session.add_all(
        [metric(other_company, 2, 9999999), metric(other_company, 2, 1, "plan")]
    )
    other_company.industry = "saas"
    await db_session.flush()
    headers = auth_headers(admin)
    bodies = []
    for company_id in (other_company.id, uuid4()):
        response = await client.get(
            endpoint,
            params={
                "company_id": str(company_id),
                "industry": "saas",
                "health": "healthy",
            },
            headers=headers,
        )
        assert response.status_code == 200
        bodies.append(response.json())
    assert bodies[0] == bodies[1]  # No existence disclosure.
    if endpoint.endswith("performance"):
        assert bodies[0] == []
    else:
        assert bodies[0]["total_companies"] == 0
        assert bodies[0]["portfolio_revenue"] is None
    mixed = await client.get(
        endpoint,
        params=[
            ("company_id", str(healthy.id)),
            ("company_id", str(other_company.id)),
            ("industry", "saas"),
            ("health", "healthy"),
            ("performance_status", "on_track"),
        ],
        headers=headers,
    )
    assert mixed.status_code == 200
    if endpoint.endswith("performance"):
        assert mixed.json() == [
            {"month": "2026-01", "fact": 100, "plan": None},
            {"month": "2026-02", "fact": 120, "plan": 110},
        ]
    else:
        assert [item["id"] for item in mixed.json()["companies"]] == [str(healthy.id)]
    # No company_id restriction: industry/derived filters still stay in tenant.
    scoped = await client.get(
        endpoint,
        params={
            "industry": "saas",
            "health": "healthy",
            "performance_status": "on_track",
        },
        headers=headers,
    )
    assert scoped.json() == mixed.json()


@pytest.mark.parametrize("path", ["/api/v1/dashboard", "/api/v1/dashboard/performance"])
async def test_admin_only_access_preserved(
    client, seeded_company_user, seeded_observer, path
):
    for user in (seeded_company_user, seeded_observer):
        response = await client.get(path, headers=auth_headers(user))
        assert response.status_code == 403
