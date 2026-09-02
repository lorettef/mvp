"""Tenant-isolation filter tests (S8 — defense-in-depth).

The global `do_orm_execute` listener scopes naive Company/User queries to the
organization in `current_org_id` (ContextVar). These tests exercise the listener
directly (naive query + escape hatch), the 403-preserving guard skip flag, and
the fail-open behavior for unauthenticated flows.
"""

import uuid

from sqlalchemy import select

from app.api.dependencies import get_current_user_full
from app.core.security import hash_password
from app.core.tenant_context import clear_current_org, current_org_id, set_current_org
from app.models.company import Company
from app.models.user import User
from .conftest import auth_headers


async def test_naive_company_query_scoped_to_org(
    db_session,
    seeded_organization,
    seeded_company,
    other_organization,
    other_company,
):
    """Naive select(Company) under an active org context returns only that org's rows."""
    set_current_org(seeded_organization.id)
    try:
        result = await db_session.execute(select(Company))
        companies = list(result.scalars().all())
    finally:
        clear_current_org()

    ids = {c.id for c in companies}
    assert seeded_company.id in ids
    assert other_company.id not in ids
    assert all(c.organization_id == seeded_organization.id for c in companies)


async def test_cross_org_company_get_still_403(
    client, db_session, seeded_admin, other_company
):
    """Cross-org company access must be 403 (guard), not 404 from the filter.

    The guard query reads Company with skip_tenant_filter so it finds the row and
    the explicit org check below returns 403 rather than the filter hiding it as 404.
    """
    res = await client.get(
        f"/api/v1/companies/{other_company.id}/metrics",
        headers=auth_headers(seeded_admin),
    )
    assert res.status_code == 403, res.text


async def test_login_unauthenticated_unfiltered(client, db_session):
    """Unauthenticated flows stay unfiltered (context never set → fail-open)."""
    user = User(
        email="tenant-login@test.ru",
        password_hash=hash_password("SecurePass1"),
        full_name="Tenant Login",
    )
    db_session.add(user)
    await db_session.flush()

    res = await client.post(
        "/api/v1/auth/login",
        json={"email": "tenant-login@test.ru", "password": "SecurePass1"},
    )
    assert res.status_code == 200, res.text

    health = await client.get("/health")
    assert health.status_code == 200, health.text


async def test_skip_tenant_filter_escape_hatch(
    db_session,
    seeded_organization,
    seeded_company,
    other_organization,
    other_company,
):
    """execution_options(skip_tenant_filter=True) bypasses the filter across orgs."""
    set_current_org(seeded_organization.id)
    try:
        result = await db_session.execute(
            select(Company).execution_options(skip_tenant_filter=True)
        )
        companies = list(result.scalars().all())
    finally:
        clear_current_org()

    ids = {c.id for c in companies}
    assert seeded_company.id in ids
    assert other_company.id in ids


async def test_get_current_user_full_resets_org_context(
    db_session, seeded_admin, seeded_organization
):
    """get_current_user_full restores the prior org context in its finally block.

    The ContextVar lives in the asyncio task, so without the finally-reset a
    request's org would leak into the next request sharing that task (keep-alive
    HTTP/1.1). Simulate a pre-existing (leaked) context with a sentinel, run the
    yield-dependency to completion, and assert the context is reset to the
    sentinel — not left at the authenticated user's org.
    """
    sentinel = uuid.uuid4()
    set_current_org(sentinel)
    try:
        gen = get_current_user_full(
            current_user={"user_id": seeded_admin.id},
            db=db_session,
        )
        user_dict = await anext(gen)
        assert user_dict["organization_id"] == seeded_organization.id
        assert current_org_id.get() == seeded_organization.id
        await gen.aclose()
        assert current_org_id.get() == sentinel
    finally:
        clear_current_org()
