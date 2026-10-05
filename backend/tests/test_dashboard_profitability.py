"""Fact-only industry snapshots, weighted margins and P&L consistency."""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import event

from app.models.budget import Budget
from app.models.company import Company
from app.models.financing import Financing
from app.models.hiring_settings import HiringSettings
from app.models.metric import Metric
from app.schemas.dashboard import DashboardFilters
from app.services.dashboard_service import DashboardService
from .conftest import auth_headers


async def company(db, org, name, industry="saas"):
    row = Company(organization_id=org.id, name=name, industry=industry)
    db.add(row)
    await db.flush()
    return row


def fact(db, row, revenue=1000, month=2, type_="fact", churn=0.05):
    db.add(
        Metric(
            company_id=row.id,
            period=date(2026, month, 1),
            type=type_,
            revenue=revenue,
            cac=10,
            ltv=100,
            churn=churn,
            retention_rate=1 - churn,
        )
    )


def budget(
    db, row, *, month=2, type_="fact", fot=0, marketing=0, development=0, gna=200
):
    db.add(
        Budget(
            company_id=row.id,
            period=date(2026, month, 1),
            type=type_,
            fot=fot,
            marketing=marketing,
            development=development,
            gna=gna,
        )
    )


async def dashboard(db, org, **filters):
    await db.flush()
    return await DashboardService(db).get_dashboard(org.id, DashboardFilters(**filters))


async def test_single_industry_company(db_session, seeded_organization):
    row = await company(db_session, seeded_organization, "A")
    fact(db_session, row)
    budget(db_session, row)
    result = await dashboard(db_session, seeded_organization)
    item = result.profitability_by_industry[0]
    assert item.model_dump() == dict(
        industry="saas",
        revenue=1000,
        total_opex=200,
        ebitda=800,
        ebitda_margin=0.8,
        companies_total=1,
        companies_included=1,
    )


async def test_weighted_industry_margin_not_average_percentages(
    db_session, seeded_organization
):
    a = await company(db_session, seeded_organization, "A")
    b = await company(db_session, seeded_organization, "B")
    fact(db_session, a, 1000)
    budget(db_session, a, gna=800)
    fact(db_session, b, 9000)
    budget(db_session, b, gna=8100)
    item = (await dashboard(db_session, seeded_organization)).profitability_by_industry[
        0
    ]
    assert item.revenue == 10000
    assert item.ebitda == 1100
    assert item.ebitda_margin == pytest.approx(0.11)
    assert item.ebitda_margin != (0.2 + 0.1) / 2
    assert item.companies_total == item.companies_included == 2


async def test_industries_null_and_other_are_distinct_with_stable_order(
    db_session, seeded_organization
):
    for name, industry in [
        ("Z", "saas"),
        ("A", "fintech"),
        ("B", None),
        ("C", "other"),
    ]:
        row = await company(db_session, seeded_organization, name, industry)
        fact(db_session, row)
        budget(db_session, row)
    service = DashboardService(db_session)
    await db_session.flush()
    first = (
        await service.get_dashboard(seeded_organization.id)
    ).profitability_by_industry
    second = (
        await service.get_dashboard(seeded_organization.id)
    ).profitability_by_industry
    assert [item.industry for item in first] == ["fintech", "other", "saas", None]
    assert first == second


@pytest.mark.parametrize(
    "revenue,opex,ebitda,margin",
    [(100, 200, -100, -1), (0, 100, -100, None), (0, 0, 0, None), (100, 100, 0, 0)],
)
async def test_negative_zero_and_zero_margin(
    db_session, seeded_organization, revenue, opex, ebitda, margin
):
    row = await company(db_session, seeded_organization, "A")
    fact(db_session, row, revenue)
    budget(db_session, row, gna=opex)
    item = (await dashboard(db_session, seeded_organization)).profitability_by_industry[
        0
    ]
    assert item.companies_included == 1
    assert item.revenue == revenue
    assert item.ebitda == ebitda
    assert item.ebitda_margin == margin


@pytest.mark.parametrize(
    "missing", ["fact", "budget", "plan_budget", "wrong_month_budget", "plan_only"]
)
async def test_missing_matching_fact_data_does_not_invent_zero_expenses(
    db_session, seeded_organization, missing
):
    row = await company(db_session, seeded_organization, "A")
    if missing != "fact":
        fact(db_session, row, type_="plan" if missing == "plan_only" else "fact")
    if missing != "budget":
        budget(
            db_session,
            row,
            type_="plan" if missing in ("plan_budget", "plan_only") else "fact",
            month=1 if missing == "wrong_month_budget" else 2,
        )
    item = (await dashboard(db_session, seeded_organization)).profitability_by_industry[
        0
    ]
    assert item.companies_total == 1
    assert item.companies_included == 0
    assert item.revenue == item.total_opex == item.ebitda == 0
    assert item.ebitda_margin is None


@pytest.mark.parametrize(
    "custom,social,opex,ebitda",
    [(False, 9060, 74060, 25940), (True, 6450, 71450, 28550)],
)
async def test_manual_financial_expected_matches_dashboard_api_and_pnl(
    client,
    db_session,
    seeded_organization,
    seeded_company,
    seeded_admin,
    custom,
    social,
    opex,
    ebitda,
):
    seeded_company.industry = "saas"
    fact(db_session, seeded_company, 100000)
    budget(
        db_session,
        seeded_company,
        fot=30000,
        marketing=10000,
        development=20000,
        gna=5000,
    )
    if custom:
        # Settings are current/unversioned, even for an older Fact snapshot.
        db_session.add(
            HiringSettings(
                company_id=seeded_company.id,
                ndfl_rate=0.75,
                insurance_rate=0.2,
                injury_rate=0.015,
                created_at=datetime(2050, 1, 1),
            )
        )
    db_session.add(
        Financing(
            company_id=seeded_company.id, type="loan", amount=1000000, annual_rate=12
        )
    )
    db_session.add(
        Financing(company_id=seeded_company.id, type="investment", amount=5000000)
    )
    await db_session.flush()
    headers = auth_headers(seeded_admin)
    response = await client.get(
        "/api/v1/dashboard", headers=headers, params={"period_to": "2026-02-28"}
    )
    assert response.status_code == 200, response.text
    item = response.json()["profitability_by_industry"][0]
    assert item["total_opex"] == opex
    assert item["ebitda"] == ebitda
    assert item["ebitda_margin"] == pytest.approx(round(ebitda / 100000, 4))
    pnl = await client.get(
        f"/api/v1/companies/{seeded_company.id}/pnl", headers=headers
    )
    assert pnl.status_code == 200, pnl.text
    actual = pnl.json()
    assert actual["months"][0]["source"] == "fact"
    assert actual["social_payments"] == social
    assert actual["total_opex"] == item["total_opex"]
    assert actual["ebitda"] == item["ebitda"]
    assert actual["net_profit"] < item["ebitda"]  # Interest is below EBITDA.


async def filter_portfolio(db, org):
    rows = [
        await company(db, org, name)
        for name in ["Healthy", "Attention", "Critical", "No data"]
    ]
    for row, revenue, plan, churn in zip(
        rows, [1000, 500, 600, None], [900, 1000, None, 1000], [0.05, 0.05, 0.4, 0.05]
    ):
        if revenue is not None:
            fact(db, row, revenue, churn=churn)
        if plan is not None:
            fact(db, row, plan, type_="plan")
        budget(db, row, gna=100)
    return rows


@pytest.mark.parametrize(
    "filters,name,included",
    [
        ({"health": ["healthy"]}, "Healthy", 1),
        ({"health": ["attention"]}, "Attention", 1),
        ({"health": ["critical"]}, "Critical", 1),
        ({"health": ["no_data"]}, "No data", 0),
        ({"performance_status": ["on_track"]}, "Healthy", 1),
        ({"performance_status": ["behind"]}, "Attention", 1),
        ({"performance_status": ["no_plan"]}, "Critical", 1),
        ({"performance_status": ["no_data"]}, "No data", 0),
    ],
)
async def test_derived_filters_apply_before_profitability(
    db_session, seeded_organization, filters, name, included
):
    await filter_portfolio(db_session, seeded_organization)
    result = await dashboard(db_session, seeded_organization, **filters)
    assert [item.name for item in result.companies] == [name]
    assert result.profitability_by_industry[0].companies_total == 1
    assert result.profitability_by_industry[0].companies_included == included


async def test_company_industry_and_combined_filters(db_session, seeded_organization):
    a = await company(db_session, seeded_organization, "A", "saas")
    b = await company(db_session, seeded_organization, "B", "fintech")
    for row in [a, b]:
        fact(db_session, row)
        budget(db_session, row, gna=100)
    for filters in [
        {"company_ids": [a.id]},
        {"industries": ["saas"]},
        {"company_ids": [a.id, b.id], "industries": ["saas"], "health": ["healthy"]},
    ]:
        result = await dashboard(db_session, seeded_organization, **filters)
        assert len(result.profitability_by_industry) == 1
        assert result.profitability_by_industry[0].industry == "saas"
        assert result.profitability_by_industry[0].companies_total == 1
    assert (
        await dashboard(db_session, seeded_organization, industries=["unknown"])
    ).profitability_by_industry == []


@pytest.mark.parametrize("from_date", [None, date(2026, 1, 1), date(2026, 2, 1)])
async def test_snapshot_range_matching_budget_and_future_data_cutoff(
    db_session, seeded_organization, from_date
):
    row = await company(db_session, seeded_organization, "A")
    for month, revenue, expense in [(1, 1000, 200), (2, 2000, 1000), (3, 9000, 8000)]:
        fact(db_session, row, revenue, month=month)
        budget(db_session, row, month=month, gna=expense)
    budget(db_session, row, month=2, type_="plan", gna=1)
    result = await dashboard(
        db_session,
        seeded_organization,
        period_from=from_date,
        period_to=date(2026, 2, 28),
    )
    item = result.profitability_by_industry[0]
    assert result.companies[0].fact.period == date(2026, 2, 1)
    assert (item.revenue, item.total_opex, item.ebitda, item.ebitda_margin) == (
        2000,
        1000,
        1000,
        0.5,
    )


async def test_no_fact_inside_selected_range(db_session, seeded_organization):
    row = await company(db_session, seeded_organization, "A")
    fact(db_session, row, month=1)
    budget(db_session, row, month=1)
    item = (
        await dashboard(
            db_session,
            seeded_organization,
            period_from=date(2026, 2, 1),
            period_to=date(2026, 2, 28),
        )
    ).profitability_by_industry[0]
    assert item.companies_total == 1
    assert item.companies_included == 0
    assert item.ebitda_margin is None


async def test_incomplete_industry_excludes_missing_budget_from_both_sums(
    db_session, seeded_organization
):
    a = await company(db_session, seeded_organization, "A")
    b = await company(db_session, seeded_organization, "B")
    fact(db_session, a)
    budget(db_session, a)
    fact(db_session, b, 9000)
    result = await dashboard(db_session, seeded_organization)
    item = result.profitability_by_industry[0]
    assert result.portfolio_revenue == 10000
    assert item.revenue == 1000  # Only companies with expenses participate.
    assert item.ebitda == 800
    assert (item.companies_total, item.companies_included) == (2, 1)


async def test_tenant_isolation_and_archived_exclusion(
    client, db_session, seeded_organization, seeded_company, seeded_admin, other_company
):
    seeded_company.industry = other_company.industry = "saas"
    archived = await company(db_session, seeded_organization, "Archived")
    archived.archived_at = datetime.now(timezone.utc)
    for row in [seeded_company, other_company, archived]:
        fact(db_session, row, 1000 if row == seeded_company else 10000000)
        budget(db_session, row, gna=100)
    await db_session.flush()
    headers = auth_headers(seeded_admin)
    response = await client.get(
        "/api/v1/dashboard",
        headers=headers,
        params=[
            ("company_id", str(seeded_company.id)),
            ("company_id", str(other_company.id)),
            ("industry", "saas"),
            ("health", "healthy"),
            ("performance_status", "no_plan"),
        ],
    )
    assert response.status_code == 200, response.text
    item = response.json()["profitability_by_industry"][0]
    assert item["companies_total"] == item["companies_included"] == 1
    assert item["revenue"] == 1000
    foreign = await client.get(
        "/api/v1/dashboard",
        headers=headers,
        params={"company_id": str(other_company.id)},
    )
    assert foreign.status_code == 200
    assert foreign.json()["profitability_by_industry"] == []


async def test_profitability_query_count_is_constant_for_one_and_25_companies(
    db_session, seeded_organization
):
    rows = [
        await company(db_session, seeded_organization, f"Company {i:02d}")
        for i in range(25)
    ]
    for row in rows:
        fact(db_session, row)
        budget(db_session, row)
    await db_session.flush()
    statements = []

    def count(_conn, _cursor, statement, _params, _context, _many):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db_session.bind.sync_engine
    event.listen(engine, "before_cursor_execute", count)
    try:
        one = await DashboardService(db_session).get_dashboard(
            seeded_organization.id, DashboardFilters(company_ids=[rows[0].id])
        )
        assert one.profitability_by_industry[0].companies_included == 1
        assert len(statements) == 6
        statements.clear()
        all_rows = await DashboardService(db_session).get_dashboard(
            seeded_organization.id
        )
        assert all_rows.profitability_by_industry[0].companies_included == 25
        assert len(statements) == 6
        assert sum("FROM hiring_settings" in query for query in statements) == 1
    finally:
        event.remove(engine, "before_cursor_execute", count)
