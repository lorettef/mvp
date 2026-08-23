from sqlalchemy import select

from .conftest import auth_headers
from app.models.analytics_event import AnalyticsEvent


async def test_track_anonymous(client, db_session):
    res = await client.post(
        "/api/v1/analytics/track",
        json={"event": "session_started", "properties": {"page": "/login"}},
    )
    assert res.status_code == 202

    result = await db_session.execute(select(AnalyticsEvent))
    events = list(result.scalars().all())
    assert len(events) == 1
    assert events[0].event == "session_started"
    assert events[0].user_id is None
    assert events[0].properties == {"page": "/login"}


async def test_track_authenticated(client, seeded_admin, db_session):
    res = await client.post(
        "/api/v1/analytics/track",
        json={"event": "recommendations_requested"},
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 202

    result = await db_session.execute(select(AnalyticsEvent))
    events = list(result.scalars().all())
    assert len(events) == 1
    assert events[0].event == "recommendations_requested"
    assert events[0].user_id == seeded_admin.id
