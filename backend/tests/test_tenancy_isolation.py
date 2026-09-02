"""Cross-tenant isolation regression matrix.

Locks in the multi-tenant isolation guarantees of the security refactor:

- An admin of org B can neither read nor write org A's company data (403).
- The observer role is strictly read-only across every write surface
  (metric upsert, recalculate, hiring generate).
- GET endpoints (/hiring, /valuation) compute on the fly and persist nothing.
- The AI cache is scoped by user_id — no cross-user reads.
- The admin weekly-report broadcast never crosses organization boundaries.

Endpoint contract (verified against app/api/v1 routers):
- metrics read:  GET  /api/v1/companies/{id}/metrics
- metrics write: PUT  /api/v1/companies/{id}/metrics   (upsert — NOT POST)
- recalculate:   POST /api/v1/companies/{id}/recalculate
- hiring read:   GET  /api/v1/companies/{id}/hiring
- hiring write:  POST /api/v1/companies/{id}/hiring/generate
- valuation:     GET  /api/v1/companies/{id}/valuation
- broadcast:     POST /api/v1/admin/send-weekly-reports
"""

import json
from datetime import date, datetime, timedelta, timezone
from unittest.mock import AsyncMock

from sqlalchemy import func, select

from .conftest import auth_headers, make_user
from app.models.ai_cache import AICache
from app.models.hiring_plan import HiringPlan
from app.models.metric import Metric
from app.schemas.recommendations import RecommendationResponse
from app.services.ai_service import AIService


METRIC_PAYLOAD = {
    "period": "2026-01-01",
    "type": "plan",
    "new_units": 10,
    "arpu": 100.0,
    "revenue": 100000.0,
    "marketing_spend": 10000.0,
    "retention_rate": 0.9,
}


async def _count_hiring_rows(db) -> int:
    result = await db.execute(select(func.count()).select_from(HiringPlan))
    return result.scalar_one()


async def test_admin_cannot_read_other_org_company(
    client, seeded_company, other_admin
):
    """Admin of org B must not read org A's company metrics (403)."""
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        headers=auth_headers(other_admin),
    )
    assert res.status_code == 403


async def test_admin_cannot_write_other_org_metric(
    client, seeded_company, other_admin
):
    """Admin of org B must not upsert a metric for org A's company (403).

    Note: the metric write endpoint is PUT /companies/{id}/metrics (upsert),
    not POST — verified against app/api/v1/companies.py.
    """
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        json=METRIC_PAYLOAD,
        headers=auth_headers(other_admin),
    )
    assert res.status_code == 403


async def test_observer_readonly_matrix(
    client, seeded_company, seeded_observer
):
    """Observer (read-only role) can read but never write, across all surfaces."""
    # Read: allowed.
    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 200

    # Metric upsert (PUT) — forbidden.
    res = await client.put(
        f"/api/v1/companies/{seeded_company.id}/metrics",
        json=METRIC_PAYLOAD,
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403

    # Recalculate — forbidden.
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/recalculate",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403

    # Hiring generate — forbidden.
    res = await client.post(
        f"/api/v1/companies/{seeded_company.id}/hiring/generate",
        headers=auth_headers(seeded_observer),
    )
    assert res.status_code == 403


async def test_get_endpoints_have_no_db_writes(
    client, seeded_company, seeded_admin, db_session
):
    """GET /hiring and GET /valuation must not persist any HiringPlan rows."""
    db_session.add(
        Metric(
            company_id=seeded_company.id,
            period=date(2026, 1, 1),
            type="fact",
            revenue=100000,
            cac=1000,
            ltv=5000,
            churn=0.03,
        )
    )
    await db_session.flush()

    before = await _count_hiring_rows(db_session)

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/hiring",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200
    assert len(res.json()["months"]) == 12

    res = await client.get(
        f"/api/v1/companies/{seeded_company.id}/valuation",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 200

    after = await _count_hiring_rows(db_session)
    # Both GETs are read-only: no new rows may be persisted.
    assert after == before


async def test_ai_cache_cross_user_isolation(db_session):
    """A cache row for user A must not be readable by user B (S3 leak)."""
    user_a = await make_user(db_session, "iso-a@test.ru", "admin")
    user_b = await make_user(db_session, "iso-b@test.ru", "admin")

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db_session.add(
        AICache(
            user_id=user_a.id,
            metrics_hash="H",
            response=json.dumps(
                RecommendationResponse(
                    summary="only-for-A", recommendations=[]
                ).model_dump()
            ),
            created_at=now,
            expires_at=now + timedelta(hours=1),
        )
    )
    await db_session.flush()

    service = AIService(db_session)

    # Cross-user read: must be None — the leak returns user A's row here.
    leaked = await service._get_cached("H", str(user_b.id))
    assert leaked is None

    # Owner read: must return the row.
    own = await service._get_cached("H", str(user_a.id))
    assert own is not None
    assert own.summary == "only-for-A"


async def test_admin_broadcast_never_crosses_org(
    client, db_session, seeded_admin, other_admin, monkeypatch
):
    """Weekly-report broadcast must never email admins of another organization."""
    mock_send_email = AsyncMock(return_value=True)
    monkeypatch.setattr("app.api.v1.admin.send_email", mock_send_email)
    monkeypatch.setattr(
        "app.api.v1.admin.WeeklyReportService.build_report_html",
        AsyncMock(return_value=""),
    )

    res = await client.post(
        "/api/v1/admin/send-weekly-reports",
        headers=auth_headers(seeded_admin),
    )

    assert res.status_code == 200

    sent_to = [call.args[0] for call in mock_send_email.await_args_list]
    # Called only with the caller org's admin email...
    assert sent_to, "send_email was never called"
    assert all(addr == seeded_admin.email for addr in sent_to)
    # ...and never with the other org's admin email.
    assert other_admin.email not in sent_to
    assert "other-admin@test.ru" not in sent_to
