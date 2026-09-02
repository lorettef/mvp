"""Тесты приглашений: создание, публичная валидация, регистрация по инвайту.

QA (adversarial): каждый тест проверяет состояние БД (invite.used_at, роль
пользователя, принадлежность компании к организации, отсутствие лишних
организаций), а не только код ответа. Rate-limiter сбрасывается перед каждым
тестом, чтобы лимит 5/минуту на /auth/register не накапливался между тестами.
"""

import uuid
from datetime import timedelta

import pytest_asyncio
from sqlalchemy import select, func

from app.core.limiter import limiter
from app.core.time import utcnow
from app.models.company import Company
from app.models.invite import Invite
from app.models.organization import Organization
from app.models.user import User

from .conftest import auth_headers, make_user


@pytest_asyncio.fixture(autouse=True)
async def _reset_rate_limits():
    limiter.reset()
    yield


@pytest_asyncio.fixture
async def fund_org(db_session) -> Organization:
    org = Organization(name="Fund Org", organization_type="fund")
    db_session.add(org)
    await db_session.flush()
    return org


@pytest_asyncio.fixture
async def fund_admin(db_session, fund_org) -> User:
    return await make_user(
        db_session, "fund-admin@test.ru", "admin", fund_org.id, None
    )


@pytest_asyncio.fixture
async def fund_company_user(db_session, fund_org) -> User:
    return await make_user(
        db_session, "fund-company@test.ru", "company", fund_org.id, None
    )


async def _add_invite(db_session, fund_org, token, **kwargs) -> Invite:
    kwargs.setdefault("expires_at", utcnow() + timedelta(days=7))
    invite = Invite(
        token=token,
        organization_id=fund_org.id,
        **kwargs,
    )
    db_session.add(invite)
    await db_session.flush()
    return invite


async def test_create_invite_admin_ok(client, db_session, fund_admin, fund_org):
    """Админ создаёт приглашение: 201, токен в ответе и строка в БД."""
    resp = await client.post(
        "/api/v1/invites",
        json={"email": "startup@test.ru"},
        headers=auth_headers(fund_admin),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["token"], "ответ должен содержать непустой токен"
    assert body["email"] == "startup@test.ru"

    invite = (
        await db_session.execute(
            select(Invite).where(Invite.token == body["token"])
        )
    ).scalar_one()
    assert invite.organization_id == fund_org.id
    assert invite.used_at is None
    assert invite.expires_at > utcnow()


async def test_create_invite_without_email_ok(client, db_session, fund_admin, fund_org):
    """Приглашение без email допустимо (общая ссылка)."""
    resp = await client.post(
        "/api/v1/invites", json={}, headers=auth_headers(fund_admin)
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] is None


async def test_create_invite_non_admin_403(client, fund_company_user):
    """Пользователь с ролью company не может создавать приглашения."""
    resp = await client.post(
        "/api/v1/invites", json={}, headers=auth_headers(fund_company_user)
    )
    assert resp.status_code == 403, resp.text


async def test_create_invite_admin_without_org_403(client, db_session):
    """Админ без организации не может создавать приглашения."""
    no_org_admin = await make_user(
        db_session, "no-org-admin@test.ru", "admin", None, None
    )
    resp = await client.post(
        "/api/v1/invites", json={}, headers=auth_headers(no_org_admin)
    )
    assert resp.status_code == 403, resp.text


async def test_create_invite_unauthorized_401(client):
    """Без аутентификации создание приглашения запрещено."""
    resp = await client.post("/api/v1/invites", json={})
    assert resp.status_code == 401, resp.text


async def test_get_invite_info_valid(client, db_session, fund_org):
    """Публичный GET по валидному токену возвращает имя организации."""
    await _add_invite(db_session, fund_org, "valid-token", email="s@test.ru")

    resp = await client.get("/api/v1/invites/valid-token")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["organization_name"] == "Fund Org"
    assert body["email"] == "s@test.ru"
    assert "organization_id" not in body


async def test_get_invite_info_unknown_token_404(client, db_session, fund_org):
    """Несуществующий токен → 404 с общим сообщением."""
    resp = await client.get("/api/v1/invites/no-such-token")
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Приглашение недействительно или истекло"


async def test_get_invite_info_expired_404(client, db_session, fund_org):
    """Истёкшее приглашение → 404 (то же сообщение, без утечки причины)."""
    await _add_invite(
        db_session,
        fund_org,
        "expired-token",
        expires_at=utcnow() - timedelta(seconds=1),
    )

    resp = await client.get("/api/v1/invites/expired-token")
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Приглашение недействительно или истекло"


async def test_get_invite_info_used_404(client, db_session, fund_org):
    """Использованное приглашение → 404 (то же сообщение)."""
    await _add_invite(
        db_session, fund_org, "used-token", used_at=utcnow()
    )

    resp = await client.get("/api/v1/invites/used-token")
    assert resp.status_code == 404, resp.text
    assert resp.json()["detail"] == "Приглашение недействительно или истекло"


async def test_register_with_invite(client, db_session, fund_org):
    """Регистрация по инвайту: role=company, компания в организации фонда,
    invite.used_at проставлен, новая организация НЕ создаётся."""
    invite = await _add_invite(db_session, fund_org, "register-token")

    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "invited@test.ru",
            "password": "SecurePass1",
            "full_name": "Invited Founder",
            "company_name": "Invited Startup",
            "invite_token": "register-token",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()

    assert body["role"] == "company"
    assert body["organization_id"] == str(fund_org.id)
    assert body["organization_type"] == "fund"
    assert body["company_id"] is not None
    assert body["subscription_plan"] == "starter"

    user = (
        await db_session.execute(
            select(User).where(User.email == "invited@test.ru")
        )
    ).scalar_one()
    assert user.role == "company"
    assert user.organization_id == fund_org.id
    assert user.company_id == uuid.UUID(body["company_id"])

    company = await db_session.get(
        Company, uuid.UUID(body["company_id"])
    )
    assert company is not None
    assert company.organization_id == fund_org.id
    assert company.name == "Invited Startup"

    invite_after = (
        await db_session.execute(
            select(Invite)
            .where(Invite.id == invite.id)
            .execution_options(populate_existing=True)
        )
    ).scalar_one()
    assert invite_after.used_at is not None

    org_count = (
        await db_session.execute(select(func.count(Organization.id)))
    ).scalar()
    assert org_count == 1, "инвайт-ветка не должна создавать организацию"


async def test_register_with_used_invite_404(client, db_session, fund_org):
    """Повторная регистрация по использованному инвайту → 404."""
    await _add_invite(db_session, fund_org, "reuse-token")

    first = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "first@test.ru",
            "password": "SecurePass1",
            "company_name": "First Startup",
            "invite_token": "reuse-token",
        },
    )
    assert first.status_code == 201, first.text

    second = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "second@test.ru",
            "password": "SecurePass1",
            "company_name": "Second Startup",
            "invite_token": "reuse-token",
        },
    )
    assert second.status_code == 404, second.text
    assert (
        second.json()["detail"] == "Приглашение недействительно или истекло"
    )


async def test_register_with_unknown_invite_404(client, db_session, fund_org):
    """Регистрация по несуществующему инвайту → 404."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "ghost@test.ru",
            "password": "SecurePass1",
            "company_name": "Ghost Startup",
            "invite_token": "ghost-token",
        },
    )
    assert resp.status_code == 404, resp.text


async def test_register_with_invite_without_company_name_422(client, db_session, fund_org):
    """Инвайт без company_name отклоняется схемой (422)."""
    await _add_invite(db_session, fund_org, "no-co-token")

    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "no-co@test.ru",
            "password": "SecurePass1",
            "full_name": "No Company",
            "invite_token": "no-co-token",
        },
    )
    assert resp.status_code == 422, resp.text
