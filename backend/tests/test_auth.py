"""Тесты 3-веточной регистрации (fund / startup) и GET /me.

QA: каждый тест проверяет состояние БД (роль, тип организации, подписку,
company_id), а не только код ответа; сбрасываем rate-limiter перед каждым
тестом, чтобы 5/минуту на /auth/register не «протекали» между тестами.
"""

import uuid

import pytest
import pytest_asyncio
from sqlalchemy import select

from app.core.limiter import limiter
from app.models.organization import Organization
from app.models.company import Company
from app.models.user import User
from app.models.subscription import Subscription

from .conftest import auth_headers


@pytest_asyncio.fixture(autouse=True)
async def _reset_rate_limits():
    limiter.reset()
    yield


def _register_payload(**overrides):
    payload = {
        "email": "fund-owner@test.ru",
        "password": "SecurePass1",
        "full_name": "Fund Owner",
        "company_name": "Fund Co",
    }
    payload.update(overrides)
    return payload


async def test_register_fund_default_creates_fund_org(client, db_session):
    """Фонд: admin tenant owner without a phantom portfolio company."""
    resp = await client.post("/api/v1/auth/register", json=_register_payload())
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["role"] == "admin"
    assert body["organization_type"] == "fund"
    assert body["company_name"] == "Fund Co"
    assert body["subscription_plan"] == "starter"
    assert body["organization_id"] is not None
    assert body["company_id"] is None

    org = await db_session.get(Organization, uuid.UUID(body["organization_id"]))
    assert org is not None
    assert org.organization_type == "fund"
    assert org.name == "Fund Co"

    user = (
        await db_session.execute(select(User).where(User.email == "fund-owner@test.ru"))
    ).scalar_one()
    assert user.role == "admin"
    assert user.company_id is None

    companies = (
        (
            await db_session.execute(
                select(Company).where(Company.organization_id == org.id)
            )
        )
        .scalars()
        .all()
    )
    assert companies == []

    sub = (
        await db_session.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
    ).scalar_one()
    assert sub.plan == "starter"


async def test_register_fund_without_company_name_422(client, db_session):
    """Фонд без company_name отклоняется схемой (422)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "fund-plain@test.ru",
            "password": "SecurePass1",
            "full_name": "Just Fund",
        },
    )
    assert resp.status_code == 422, resp.text


async def test_register_fund_without_full_name_422(client, db_session):
    """Фонд без full_name отклоняется схемой (422)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "fund-anon@test.ru",
            "password": "SecurePass1",
            "company_name": "Fund Co",
        },
    )
    assert resp.status_code == 422, resp.text


async def test_register_standalone_startup(client, db_session):
    """Самостоятельный стартап: admin, организация типа startup, своя компания."""
    resp = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(
            email="startup-owner@test.ru",
            full_name="Startup Founder",
            company_name="Startup Co",
            account_type="startup",
        ),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["role"] == "admin"
    assert body["organization_type"] == "startup"
    assert body["company_id"] is not None

    org = await db_session.get(Organization, uuid.UUID(body["organization_id"]))
    assert org.organization_type == "startup"
    assert org.name == "Startup Co"

    user = (
        await db_session.execute(
            select(User).where(User.email == "startup-owner@test.ru")
        )
    ).scalar_one()
    assert user.role == "admin"
    assert user.organization_id == org.id
    assert user.company_id is not None


async def test_register_standalone_startup_with_industry_geography(client, db_session):
    """Стартап при регистрации указывает сферу и местоположение — сохраняются на компании."""
    resp = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(
            email="startup-geo@test.ru",
            full_name="Startup Founder",
            company_name="Geo Startup",
            account_type="startup",
            industry="saas",
            geography="Германия",
        ),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    company = await db_session.get(Company, uuid.UUID(body["company_id"]))
    assert company is not None
    assert company.industry == "saas"
    assert company.geography == "Германия"


async def test_register_standalone_without_company_name_422(client):
    """Стартап без company_name отклоняется схемой (422)."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "startup-no-co@test.ru",
            "password": "SecurePass1",
            "full_name": "Startup Founder",
            "account_type": "startup",
        },
    )
    assert resp.status_code == 422, resp.text


async def test_me_returns_organization_type(client, db_session):
    """GET /auth/me возвращает organization_type организации пользователя."""
    resp = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(email="me-owner@test.ru"),
    )
    assert resp.status_code == 201, resp.text

    user = (
        await db_session.execute(select(User).where(User.email == "me-owner@test.ru"))
    ).scalar_one()

    me = await client.get("/api/v1/auth/me", headers=auth_headers(user))
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["organization_type"] == "fund"
    assert body["role"] == "admin"
    assert body["organization_id"] is not None


@pytest.mark.parametrize(
    "password", ["password123", "PASSWORD123", "Password", "Pass1"]
)
async def test_register_rejects_passwords_outside_canonical_policy(client, password):
    response = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(
            email=f"weak-{len(password)}-{password[:2]}@test.ru", password=password
        ),
    )
    assert response.status_code == 422, response.text
    assert response.json()["detail"][0]["loc"][-1] == "password"


async def test_register_normalizes_identity_fields_and_sets_session_cookie(
    client, db_session
):
    response = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(
            email=" Founder@Example.COM ",
            password="Password123",
            full_name="  Иван  ",
            company_name="  Canonical Fund  ",
        ),
    )
    assert response.status_code == 201, response.text
    assert response.json()["email"] == "founder@example.com"
    assert response.json()["full_name"] == "Иван"
    assert response.json()["company_name"] == "Canonical Fund"
    cookie = response.headers["set-cookie"]
    assert "access_token=" in cookie
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Path=/" in cookie

    token = response.cookies.get("access_token")
    me = await client.get(
        "/api/v1/auth/me", headers={"Cookie": f"access_token={token}"}
    )
    assert me.status_code == 200, me.text
    assert me.json()["email"] == "founder@example.com"


async def test_login_and_duplicate_email_are_case_insensitive(client):
    created = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(email="case@example.com", password="Password123"),
    )
    assert created.status_code == 201
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": " CASE@EXAMPLE.COM ", "password": "Password123"},
    )
    assert login.status_code == 200, login.text
    duplicate = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(email="Case@Example.com", password="Password123"),
    )
    assert duplicate.status_code == 409, duplicate.text
    assert duplicate.json()["detail"] == "Аккаунт с таким email уже существует"


async def test_register_rejects_names_blank_after_trim(client):
    response = await client.post(
        "/api/v1/auth/register",
        json=_register_payload(email="blank@test.ru", full_name="   "),
    )
    assert response.status_code == 422
    assert response.json()["detail"][0]["loc"][-1] == "full_name"
