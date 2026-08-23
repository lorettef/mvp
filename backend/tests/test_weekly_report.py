from datetime import date

from .conftest import auth_headers
from app.models.metric import Metric
from app.services.weekly_report_service import WeeklyReportService


async def test_weekly_report_html(client, seeded_company, db_session):
    db_session.add(
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 2, 1),
            type="fact",
            mrr=200000,
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
