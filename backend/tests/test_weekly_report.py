from datetime import date

from sqlalchemy import event

from .conftest import auth_headers
from app.models.budget import Budget
from app.models.cohort import Cohort
from app.models.company import Company
from app.models.financing import Financing
from app.models.metric import Metric
from app.services.weekly_report_service import WeeklyReportService

# Exact HTML produced by the LEGACY (pre-batching) build_report_html for the
# portfolio seeded by _seed_fact_company("Test Startup") +
# _seed_plan_only_company("Beta Labs"). Captured as characterization BEFORE the
# DB-batching refactor; the refactored build must reproduce it byte-for-byte.
LEGACY_SNAPSHOT_HTML = '<html><body><h2>Еженедельный отчёт по портфелю</h2><h3>Beta Labs</h3><ul><li>MRR: 80,000 ₽</li><li>CAC: 600 ₽</li><li>LTV: 3,000 ₽</li><li>Churn: 2.0%</li><li>Runway: 5.1 мес.</li></ul><ul><li>✅ LTV/CAC = 5.00 — отличный показатель.</li><li>✅ Churn = 2.0% — в норме.</li><li>⚠️ Runway = 5.1 мес. (критично &lt; 6).</li><li>✅ Magic Number = 1.11 — эффективные продажи.</li></ul><h3>Test Startup</h3><ul><li>MRR: 200,000 ₽</li><li>CAC: 1,000 ₽</li><li>LTV: 5,000 ₽</li><li>Churn: 3.5%</li><li>Runway: 7.1 мес.</li></ul><ul><li>✅ LTV/CAC = 5.00 — отличный показатель.</li><li>✅ Churn = 3.5% — в норме.</li><li>📊 Runway = 7.1 мес. (рекомендуется &gt; 12).</li><li>✅ Magic Number = 2.50 — эффективные продажи.</li></ul></body></html>'


async def _make_company(db_session, organization_id, name: str) -> Company:
    company = Company(
        organization_id=organization_id,
        name=name,
        industry="SaaS",
        geography="RU",
    )
    db_session.add(company)
    await db_session.flush()
    return company


async def _seed_fact_company(db_session, company: Company) -> None:
    """2 fact metrics (ΔMRR), 1 plan metric, fact cohort, fact+plan budgets, investment."""
    db_session.add_all(
        [
            Metric(
                company_id=company.id,
                period=date(2026, 1, 1),
                type="fact",
                revenue=150000,
                cac=800,
                ltv=4800,
                churn=0.03,
                arpu=500,
                marketing_spend=10000,
            ),
            Metric(
                company_id=company.id,
                period=date(2026, 2, 1),
                type="fact",
                revenue=200000,
                cac=1000,
                ltv=5000,
                churn=0.035,
                arpu=600,
                marketing_spend=12000,
            ),
            Metric(
                company_id=company.id,
                period=date(2026, 3, 1),
                type="plan",
                revenue=250000,
                cac=1200,
                ltv=6000,
                churn=0.04,
                arpu=700,
                marketing_spend=15000,
            ),
            Cohort(
                company_id=company.id,
                period=date(2026, 2, 1),
                type="fact",
                retention_m1=0.9,
                retention_m3=0.8,
                retention_m6=0.7,
                retention_m12=0.6,
            ),
            Budget(
                company_id=company.id,
                period=date(2026, 2, 1),
                type="fact",
                marketing=20000,
                development=50000,
                fot=60000,
                gna=10000,
            ),
            Budget(
                company_id=company.id,
                period=date(2026, 3, 1),
                type="plan",
                marketing=25000,
                development=55000,
                fot=65000,
                gna=11000,
            ),
            Financing(company_id=company.id, type="investment", amount=1000000),
        ]
    )
    await db_session.flush()


async def _seed_plan_only_company(db_session, company: Company) -> None:
    """Plan-only dataset: fact→plan metric fallback, plan budget, credit-only financing."""
    db_session.add_all(
        [
            Metric(
                company_id=company.id,
                period=date(2026, 1, 1),
                type="plan",
                revenue=70000,
                cac=500,
                ltv=2800,
                churn=0.025,
                arpu=350,
            ),
            Metric(
                company_id=company.id,
                period=date(2026, 2, 1),
                type="plan",
                revenue=80000,
                cac=600,
                ltv=3000,
                churn=0.02,
                arpu=400,
            ),
            Budget(
                company_id=company.id,
                period=date(2026, 2, 1),
                type="plan",
                marketing=9000,
                development=20000,
                fot=25000,
                gna=5000,
            ),
            Financing(company_id=company.id, type="credit", amount=300000),
        ]
    )
    await db_session.flush()


async def test_weekly_report_html(client, seeded_company, db_session):
    db_session.add(
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 2, 1),
            type="fact",
            revenue=200000,
            cac=1000,
            ltv=5000,
            churn=0.035,
        )
    )
    await db_session.flush()

    svc = WeeklyReportService(db_session)
    html = await svc.build_report_html(seeded_company.organization_id)
    assert "Test Startup" in html
    assert "MRR" in html


async def test_build_report_html_matches_legacy_snapshot(db_session, seeded_company):
    """HTML must be byte-identical to the pre-refactor (N+1) implementation."""
    beta = await _make_company(db_session, seeded_company.organization_id, "Beta Labs")
    await _seed_fact_company(db_session, seeded_company)
    await _seed_plan_only_company(db_session, beta)

    svc = WeeklyReportService(db_session)
    html = await svc.build_report_html(seeded_company.organization_id)
    assert html == LEGACY_SNAPSHOT_HTML


async def test_build_report_html_query_count(db_session, seeded_company):
    """Refactored build must run in far fewer queries than the legacy N+1 loop."""
    beta = await _make_company(db_session, seeded_company.organization_id, "Beta Labs")
    gamma = await _make_company(db_session, seeded_company.organization_id, "Gamma Inc")
    for company in (seeded_company, beta, gamma):
        await _seed_fact_company(db_session, company)

    engine = db_session.get_bind()
    sync_engine = getattr(engine, "sync_engine", engine)
    statements = []

    def _on_execute(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(sync_engine, "before_cursor_execute", _on_execute)
    try:
        svc = WeeklyReportService(db_session)
        await svc.build_report_html(seeded_company.organization_id)
    finally:
        event.remove(sync_engine, "before_cursor_execute", _on_execute)

    # Legacy: 1 (companies) + 3 × (metrics + cohort + budget + financing) ≈ 13.
    # Refactored: 1 (companies) + 1 (metrics) + 1 (cohorts) + 1 (budgets) + 1 (financing) = 5.
    assert len(statements) < 8, f"{len(statements)} queries: {statements}"


async def test_send_weekly_reports_admin(client, seeded_admin):
    res = await client.post(
        "/api/v1/admin/send-weekly-reports",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] >= 1
    assert body["sent"] == 0  # SMTP не сконфигурирован в тестах


async def test_send_weekly_reports_forbidden(client, seeded_company_user):
    res = await client.post(
        "/api/v1/admin/send-weekly-reports",
        headers=auth_headers(seeded_company_user),
    )
    assert res.status_code == 403
