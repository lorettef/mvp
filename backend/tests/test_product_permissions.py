"""E24A: product roles, real HTTP authorization and strict startup ownership."""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
import pytest_asyncio
from app.core.product_roles import resolve_product_role
from app.core.security import decode_access_token
from app.main import app
from app.models.company import Company
from app.models.organization import Organization
from app.models.subscription import Subscription
from app.services.insight_service import InsightService
from app.services.portfolio_insight_service import PortfolioInsightService
from sqlalchemy import func, select

from .conftest import auth_headers, make_user


@pytest.mark.parametrize(
    "role,org_type,binding,expected",
    [
        ("admin", "fund", "none", "fund"),
        ("admin", "startup", "valid", "startup"),
        ("admin", "startup", "none", "startup"),
        ("company", "fund", "valid", "startup"),
        ("company", "startup", "valid", "startup"),
        ("observer", "fund", "none", "investor"),
        ("observer", "startup", "valid", None),
        ("root", "fund", "valid", None),
        ("admin", "unknown", "none", None),
        ("company", "fund", "none", None),
        ("company", "fund", "foreign", None),
        ("admin", "startup", "foreign", None),
        ("admin", None, "none", None),
    ],
)
def test_role_mapping(role, org_type, binding, expected):
    org_id, company_id = uuid4(), uuid4()
    user = SimpleNamespace(role=role, organization_id=org_id, company_id=None)
    organization = SimpleNamespace(id=org_id, organization_type=org_type)
    company = None
    if binding != "none":
        user.company_id = company_id
        company = SimpleNamespace(
            id=company_id,
            organization_id=uuid4() if binding == "foreign" else org_id,
        )
    assert (
        resolve_product_role(user, organization if org_type else None, company)
        == expected
    )


@pytest_asyncio.fixture
async def startup(db_session):
    org = Organization(name="Standalone", organization_type="startup")
    db_session.add(org)
    await db_session.flush()
    own = Company(name="Own", organization_id=org.id)
    sibling = Company(name="Same tenant, different owner", organization_id=org.id)
    db_session.add_all([own, sibling])
    await db_session.flush()
    user = await make_user(
        db_session, "standalone@permissions.test", "admin", org.id, own.id
    )
    return user, own, sibling


async def test_me_additive_contract_and_unchanged_jwt(client, db_session, startup):
    user, own, _ = startup
    db_session.add(Subscription(user_id=user.id, plan="pro"))
    await db_session.flush()
    headers = auth_headers(user)
    claims = decode_access_token(headers["Authorization"].removeprefix("Bearer "))
    assert set(claims) == {"sub", "exp", "jti"}
    response = await client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["product_role"] == "startup"
    assert data["role"] == "admin"
    assert data["organization_type"] == "startup"
    assert data["company_id"] == str(own.id)


async def test_startup_exact_binding_and_portfolio_denials(
    client, startup, other_company
):
    user, own, sibling = startup
    headers = auth_headers(user)
    payload = {
        "period": "2026-01-01",
        "type": "fact",
        "new_units": 10,
        "arpu": 100,
        "revenue": 1000,
        "marketing_spend": 100,
        "retention_rate": 0.9,
    }
    assert (
        await client.get(f"/api/v1/companies/{own.id}", headers=headers)
    ).status_code == 200
    assert (
        await client.put(
            f"/api/v1/companies/{own.id}/metrics", headers=headers, json=payload
        )
    ).status_code == 200
    for foreign in (sibling, other_company):
        assert (
            await client.get(f"/api/v1/companies/{foreign.id}", headers=headers)
        ).status_code == 403
        assert (
            await client.put(
                f"/api/v1/companies/{foreign.id}/metrics", headers=headers, json=payload
            )
        ).status_code == 403
    listing = await client.get("/api/v1/companies", headers=headers)
    assert listing.status_code == 403
    for method, path in [
        ("GET", "/dashboard"),
        ("GET", "/dashboard/performance"),
        ("POST", "/insights/portfolio"),
        ("POST", "/invites"),
        ("POST", "/companies"),
    ]:
        assert (
            await client.request(method, "/api/v1" + path, headers=headers, json={})
        ).status_code == 403


async def test_initial_provisioning_binds_once(client, db_session):
    org = Organization(name="Unprovisioned", organization_type="startup")
    db_session.add(org)
    await db_session.flush()
    user = await make_user(db_session, "initial@permissions.test", "admin", org.id)
    headers = auth_headers(user)
    first = await client.post(
        "/api/v1/companies", headers=headers, json={"name": "First"}
    )
    assert first.status_code == 201, first.text
    assert str(user.company_id) == first.json()["id"]
    second = await client.post(
        "/api/v1/companies", headers=headers, json={"name": "Second"}
    )
    assert second.status_code == 403
    assert await db_session.scalar(select(func.count()).select_from(Company)) == 1
    assert (
        await client.get(f"/api/v1/companies/{user.company_id}", headers=headers)
    ).status_code == 200


async def test_investor_all_company_routes_denied(
    client, seeded_observer, seeded_company
):
    """Inventory every registered descendant, including future additions."""
    headers = auth_headers(seeded_observer)
    for route in app.routes:
        if not route.path.startswith("/api/v1/companies/{company_id}"):
            continue
        path = route.path.replace("{company_id}", str(seeded_company.id))
        path = path.replace("{scenario}", "overview")
        for key in ("metric_id", "budget_id", "cohort_id", "financing_id", "task_id"):
            path = path.replace("{" + key + "}", str(uuid4()))
        assert "{" not in path, path
        for method in route.methods - {"HEAD", "OPTIONS"}:
            response = await client.request(method, path, headers=headers, json={})
            assert response.status_code == 403, (method, path, response.text)
    for path in ("/dashboard", "/dashboard/performance", "/companies"):
        assert (await client.get("/api/v1" + path, headers=headers)).status_code == 200
    for path in ("/invites", "/insights/portfolio"):
        assert (
            await client.post("/api/v1" + path, headers=headers, json={})
        ).status_code == 403


@pytest.mark.parametrize(
    "path",
    [
        "metrics",
        "metrics/bulk",
        "budgets",
        "cohorts",
        "hiring/settings",
        "hiring/team",
        "hiring/approve",
    ],
)
async def test_fund_source_put_denied(client, seeded_admin, seeded_company, path):
    response = await client.put(
        f"/api/v1/companies/{seeded_company.id}/{path}",
        headers=auth_headers(seeded_admin),
        json={},
    )
    assert response.status_code == 403


@pytest.mark.parametrize(
    "method,path",
    [
        ("PATCH", ""),
        ("POST", "/financing"),
        ("PATCH", "/financing/{id}"),
        ("DELETE", "/financing/{id}"),
        ("DELETE", "/metrics/{id}"),
        ("DELETE", "/budgets/{id}"),
        ("DELETE", "/cohorts/{id}"),
        ("POST", "/generate-plan"),
        ("POST", "/hiring/generate"),
        ("POST", "/tasks"),
        ("PATCH", "/tasks/{id}"),
        ("DELETE", "/tasks/{id}"),
        ("POST", "/recommendations"),
    ],
)
async def test_fund_other_source_mutations_denied(
    client, seeded_admin, seeded_company, method, path
):
    path = path.replace("{id}", str(uuid4()))
    response = await client.request(
        method,
        f"/api/v1/companies/{seeded_company.id}{path}",
        headers=auth_headers(seeded_admin),
        json={},
    )
    assert response.status_code == 403


async def test_read_ai_and_invite_policies(
    client, startup, seeded_admin, seeded_company, monkeypatch
):
    narrative = AsyncMock(
        side_effect=lambda cid, scenario, uid: {
            "company_id": cid,
            "scenario": scenario,
            "provider": "demo",
            "text": "Review",
        }
    )
    monkeypatch.setattr(InsightService, "narrate", narrative)
    monkeypatch.setattr(
        PortfolioInsightService,
        "narrate",
        AsyncMock(return_value={"provider": "demo", "text": "Portfolio"}),
    )
    for user, company in ((seeded_admin, seeded_company), (startup[0], startup[1])):
        headers = auth_headers(user)
        for suffix in (
            "",
            "/metrics",
            "/budgets",
            "/cohorts",
            "/pnl",
            "/cashflow",
            "/unit-economics",
            "/health",
        ):
            assert (
                await client.get(
                    f"/api/v1/companies/{company.id}{suffix}", headers=headers
                )
            ).status_code == 200
        assert (
            await client.post(
                f"/api/v1/companies/{company.id}/insights/overview", headers=headers
            )
        ).status_code == 200
    headers = auth_headers(seeded_admin)
    assert (
        await client.post("/api/v1/insights/portfolio", headers=headers)
    ).status_code == 200
    assert (
        await client.post("/api/v1/invites", headers=headers, json={})
    ).status_code == 201


async def test_fund_cannot_overwrite_startup_source(
    client, seeded_company, seeded_company_user, seeded_admin
):
    path = f"/api/v1/companies/{seeded_company.id}/metrics"
    original = {
        "period": "2026-09-01",
        "type": "fact",
        "new_units": 10,
        "arpu": 100,
        "revenue": 1000,
        "marketing_spend": 100,
        "retention_rate": 0.9,
        "comment": "Startup source",
    }
    created = await client.put(
        path, headers=auth_headers(seeded_company_user), json=original
    )
    assert created.status_code == 200
    rejected = await client.put(
        path,
        headers=auth_headers(seeded_admin),
        json={**original, "revenue": 999999, "comment": "Fund source edit"},
    )
    assert rejected.status_code == 403
    visible = await client.get(path, headers=auth_headers(seeded_admin))
    assert visible.status_code == 200
    assert visible.json() == [created.json()]


@pytest.mark.parametrize(
    "role,org_type,bind",
    [
        ("unknown", "fund", True),
        ("admin", "unknown", False),
        ("observer", "startup", True),
        ("company", "fund", False),
    ],
)
async def test_inconsistent_context_has_no_product_access(
    client, db_session, seeded_organization, seeded_company, role, org_type, bind
):
    seeded_organization.organization_type = org_type
    user = await make_user(
        db_session,
        "invalid@permissions.test",
        role,
        seeded_organization.id,
        seeded_company.id if bind else None,
    )
    db_session.add(Subscription(user_id=user.id, plan="pro"))
    await db_session.flush()
    headers = auth_headers(user)
    me = await client.get("/api/v1/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["product_role"] is None
    assert me.json()["role"] == role
    for path in (
        "/dashboard",
        "/dashboard/performance",
        "/companies",
        f"/companies/{seeded_company.id}",
    ):
        assert (await client.get("/api/v1" + path, headers=headers)).status_code == 403
    assert (
        await client.put(
            f"/api/v1/companies/{seeded_company.id}/metrics", headers=headers, json={}
        )
    ).status_code == 403
