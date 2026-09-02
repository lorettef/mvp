"""Tests for auth dependencies: get_current_org + dual-channel token contract."""
import uuid

import pytest
from fastapi import HTTPException

from .conftest import auth_cookie, auth_headers
from app.api.dependencies import get_current_org
from app.models.subscription import Subscription


async def test_get_current_org_returns_org_id():
    org_id = uuid.uuid4()
    result = await get_current_org(current_user={"organization_id": org_id})
    assert result == org_id


async def test_get_current_org_none_403():
    with pytest.raises(HTTPException) as exc_info:
        await get_current_org(current_user={"organization_id": None})
    assert exc_info.value.status_code == 403
    assert "организации" in exc_info.value.detail


async def test_bearer_and_cookie_channels_equivalent(client, seeded_admin, db_session):
    # /auth/me requires a Subscription row; seed it once, before both calls,
    # so no state changes between them (no login -> no last_login writes).
    db_session.add(
        Subscription(user_id=seeded_admin.id, plan="pro", status="active", daily_limit=10)
    )
    await db_session.flush()

    res_bearer = await client.get("/api/v1/auth/me", headers=auth_headers(seeded_admin))
    res_cookie = await client.get("/api/v1/auth/me", cookies=auth_cookie(seeded_admin))

    assert res_bearer.status_code == 200
    assert res_cookie.status_code == 200
    # Full-body equivalence: both channels must yield identical payloads.
    assert res_bearer.json() == res_cookie.json()
