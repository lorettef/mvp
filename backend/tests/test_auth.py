"""Тесты 3-веточной регистрации (fund / startup) и GET /me.

QA: каждый тест проверяет состояние БД (роль, тип организации, подписку,
company_id), а не только код ответа; сбрасываем rate-limiter перед каждым
тестом, чтобы 5/минуту на /auth/register не «протекали» между тестами.
"""

import uuid

import pytest_asyncio
from sqlalchemy import select

from app.core.limiter import limiter
from app.models.organization import Organization
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
    """Фонд (ветка по умолчанию): admin, организация типа fund, компания и подписка."""
    resp = await client.post(
        "/api/v1/auth/register", json=_register_payload()
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["role"] == "admin"
    assert body["organization_type"] == "fund"
    assert body["company_name"] == "Fund Co"
    assert body["subscription_plan"] == "starter"
    assert body["organization_id"] is not None
    assert body["company_id"] is not None

    org = await db_session.get(
        Organization, uuid.UUID(body["organization_id"])
    )
    assert org is not None
    assert org.organization_type == "fund"
    assert org.name == "Fund Co"

    user = (
        await db_session.execute(
            select(User).where(User.email == "fund-owner@test.ru")
        )
    ).scalar_one()
    assert user.role == "admin"
    assert user.company_id == uuid.UUID(body["company_id"])

    sub = (
        await db_session.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
    ).scalar_one()
    assert sub.plan == "starter"


async def test_register_fund_without_company_name(client, db_session):
    """Фонд без company_name: имя организации из full_name, без компании."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "fund-plain@test.ru",
            "password": "SecurePass1",
            "full_name": "Just Fund",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["organization_type"] == "fund"
    assert body["company_id"] is None
    assert body["company_name"] is None

    org = await db_session.get(
        Organization, uuid.UUID(body["organization_id"])
    )
    assert org.name == "Just Fund"
    assert org.organization_type == "fund"


async def test_register_fund_default_org_name(client, db_session):
    """Фонд без company_name и full_name: дефолтное имя организации."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "fund-anon@test.ru",
            "password": "SecurePass1",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["organization_type"] == "fund"
    assert body["company_id"] is None

    org = await db_session.get(
        Organization, uuid.UUID(body["organization_id"])
    )
    assert org.name == "Мой акселератор"
    assert org.organization_type == "fund"


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

    org = await db_session.get(
        Organization, uuid.UUID(body["organization_id"])
    )
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
        await db_session.execute(
            select(User).where(User.email == "me-owner@test.ru")
        )
    ).scalar_one()

    me = await client.get(
        "/api/v1/auth/me", headers=auth_headers(user)
    )
    assert me.status_code == 200, me.text
    body = me.json()
    assert body["organization_type"] == "fund"
    assert body["role"] == "admin"
    assert body["organization_id"] is not None
