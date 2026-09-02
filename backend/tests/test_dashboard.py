from datetime import date

from sqlalchemy import event

from app.models.company import Company
from app.models.metric import Metric
from app.models.task import Task
from app.services.dashboard_service import DashboardService


async def _seed_dashboard_data(db, org):
    """3 companies: Alpha (on_track, 67% tasks), Beta (behind, 50%), Gamma (empty)."""
    alpha = Company(
        organization_id=org.id,
        name="Alpha Startup",
        industry="SaaS",
        geography="US",
    )
    beta = Company(
        organization_id=org.id,
        name="Beta Startup",
        industry="Fintech",
        geography="EU",
    )
    gamma = Company(
        organization_id=org.id,
        name="Gamma Startup",
        industry=None,
        geography=None,
    )
    db.add_all([alpha, beta, gamma])
    await db.flush()

    def _metric(company, period, type_, revenue, cac, ltv, churn):
        return Metric(
            company_id=company.id,
            period=period,
            type=type_,
            revenue=revenue,
            cac=cac,
            ltv=ltv,
            churn=churn,
        )

    db.add_all(
        [
            # Alpha: two months of fact + plan; latest fact (1200) >= latest plan (1100) -> on_track
            _metric(alpha, date(2026, 1, 1), "fact", 1000.0, 120.0, 350.0, 0.08),
            _metric(alpha, date(2026, 2, 1), "fact", 1200.0, 110.0, 320.0, 0.05),
            _metric(alpha, date(2026, 1, 1), "plan", 900.0, 100.0, 300.0, 0.05),
            _metric(alpha, date(2026, 2, 1), "plan", 1100.0, 105.0, 310.0, 0.05),
            # Beta: single month each; latest fact (800) < latest plan (1000) -> behind
            _metric(beta, date(2026, 1, 1), "fact", 800.0, 90.0, 280.0, 0.05),
            _metric(beta, date(2026, 1, 1), "plan", 1000.0, 100.0, 300.0, 0.05),
        ]
    )
    db.add_all(
        [
            # Alpha: 2 of 3 done -> round(2/3*100) = 67
            Task(company_id=alpha.id, title="t1", stage="metrics", status="done"),
            Task(company_id=alpha.id, title="t2", stage="metrics", status="done"),
            Task(company_id=alpha.id, title="t3", stage="metrics", status="pending"),
            # Beta: 1 of 2 done -> 50
            Task(company_id=beta.id, title="t4", stage="metrics", status="done"),
            Task(company_id=beta.id, title="t5", stage="metrics", status="in_progress"),
        ]
    )
    await db.flush()
    await db.commit()
    return alpha, beta, gamma


async def test_dashboard_snapshot_unchanged(db_session, seeded_organization):
    """Characterization: full expected response body, derived from current behavior."""
    alpha, beta, gamma = await _seed_dashboard_data(db_session, seeded_organization)

    response = await DashboardService(db_session).get_dashboard(seeded_organization.id)

    expected = {
        "total_companies": 3,
        "avg_revenue": 1000.0,
        "avg_cac": 100.0,
        "avg_ltv": 300.0,
        "avg_churn": 0.05,
        "on_track": 1,
        "behind": 1,
        "no_plan": 0,
        "no_data": 1,
        "companies": [
            {
                "id": str(alpha.id),
                "name": "Alpha Startup",
                "industry": "SaaS",
                "geography": "US",
                "status": "on_track",
                "latest_revenue": 1200.0,
                "latest_plan_revenue": 1100.0,
                "task_progress": 67,
            },
            {
                "id": str(beta.id),
                "name": "Beta Startup",
                "industry": "Fintech",
                "geography": "EU",
                "status": "behind",
                "latest_revenue": 800.0,
                "latest_plan_revenue": 1000.0,
                "task_progress": 50,
            },
            {
                "id": str(gamma.id),
                "name": "Gamma Startup",
                "industry": None,
                "geography": None,
                "status": "no_data",
                "latest_revenue": None,
                "latest_plan_revenue": None,
                "task_progress": None,
            },
        ],
    }

    assert response.model_dump(mode="json") == expected


async def test_dashboard_query_count_bound(db_session, seeded_organization):
    """get_dashboard must issue a bounded number of SELECTs (no per-company N+1)."""
    await _seed_dashboard_data(db_session, seeded_organization)

    selects: list[str] = []

    def _count(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            selects.append(statement)

    engine = db_session.bind
    event.listen(engine.sync_engine, "before_cursor_execute", _count)
    try:
        await DashboardService(db_session).get_dashboard(seeded_organization.id)
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", _count)

    assert len(selects) <= 5, f"expected <= 5 SELECTs, got {len(selects)}"
