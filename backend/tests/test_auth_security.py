"""Auth hardening tests.

S1  — secure httpOnly cookie on login and seed
S6/D5 — jti claim + sliding session via POST /auth/refresh
S9  — demo password guard (403 when DEMO_ACCOUNT_PASSWORD is None)
"""

import asyncio
from uuid import uuid4

import pytest
from pydantic import SecretStr

from app.core.config import settings
from app.core.security import create_access_token, decode_access_token, hash_password
from app.models.user import User
from .conftest import auth_headers


def _cookie_parts(set_cookie: str) -> list[str]:
    """Split a Set-Cookie header into trimmed attribute parts."""
    return [part.strip() for part in set_cookie.split(";")]


async def _create_login_user(db_session, email: str = "login-secure@test.ru", password: str = "SecurePass1") -> User:
    """Create a user with a REAL bcrypt password hash."""
    user = User(
        email=email,
        password_hash=hash_password(password),
        full_name="Secure Login User",
    )
    db_session.add(user)
    await db_session.flush()
    return user


async def test_login_sets_secure_httponly_cookie(client, db_session):
    """S1: login cookie must be Secure + HttpOnly + SameSite=lax."""
    await _create_login_user(db_session)
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login-secure@test.ru", "password": "SecurePass1"},
    )
    assert resp.status_code == 200, resp.text

    set_cookie = resp.headers.get("set-cookie", "")
    assert set_cookie, "login must set a cookie"
    parts = _cookie_parts(set_cookie)
    assert "Secure" in parts
    assert "HttpOnly" in parts
    assert "SameSite=lax" in parts


def test_access_token_contains_jti():
    """S6: every access token carries a non-empty jti claim."""
    token = create_access_token({"sub": str(uuid4())})
    payload = decode_access_token(token)
    assert payload is not None
    assert "jti" in payload
    assert isinstance(payload["jti"], str)
    assert payload["jti"] != ""


async def test_refresh_extends_session(client, seeded_admin):
    """D5: refresh issues a NEW token whose exp is later than the original's."""
    headers = auth_headers(seeded_admin)
    original_token = headers["Authorization"].split(" ", 1)[1]
    original_payload = decode_access_token(original_token)
    assert original_payload is not None

    # exp is second-granularity in JWT; guarantee the new token lands in a later second
    await asyncio.sleep(1.1)

    resp = await client.post("/api/v1/auth/refresh", headers=headers)
    assert resp.status_code == 200, resp.text

    set_cookie = resp.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie, "refresh must re-set the cookie"
    new_token = set_cookie.split("access_token=", 1)[1].split(";", 1)[0]
    new_payload = decode_access_token(new_token)
    assert new_payload is not None
    # Misleading-success guard: decode the NEW token's exp, not just check 200.
    assert new_payload["exp"] > original_payload["exp"]
    # And it is a genuinely fresh token, not a replay of the old one.
    assert new_payload.get("jti") != original_payload.get("jti")


async def test_refresh_invalid_token_401(client):
    """Refresh with no token or a garbage token must be rejected with 401."""
    # No credentials at all
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401, resp.text

    # Garbage bearer token
    resp = await client.post(
        "/api/v1/auth/refresh",
        headers={"Authorization": "Bearer garbage"},
    )
    assert resp.status_code == 401, resp.text


async def test_seed_without_demo_password_403(client, monkeypatch):
    """S9: seed with DEMO_MODE=true but no demo password configured -> 403."""
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "DEMO_ACCOUNT_PASSWORD", None)

    resp = await client.post("/api/v1/auth/seed")
    assert resp.status_code == 403, resp.text


async def test_seed_cookie_also_secure(client, monkeypatch):
    """S1: the seed auto-login cookie is Secure too."""
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "DEMO_ACCOUNT_PASSWORD", SecretStr("demo123"))

    resp = await client.post("/api/v1/auth/seed")
    assert resp.status_code == 201, resp.text

    set_cookie = resp.headers.get("set-cookie", "")
    assert set_cookie, "seed must set a cookie"
    parts = _cookie_parts(set_cookie)
    assert "Secure" in parts
    assert "HttpOnly" in parts
    assert "SameSite=lax" in parts
