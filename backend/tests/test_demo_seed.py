import json
from uuid import UUID

import pytest
from pydantic import SecretStr
from sqlalchemy import func, select

from app.core.config import settings
from app.models.budget import Budget
from app.models.cohort import Cohort
from app.models.company import Company
from app.models.financing import Financing
from app.models.hiring_plan_row import HiringPlanRow
from app.models.hiring_team import HiringTeam
from app.models.metric import Metric
from app.models.organization import Organization
from app.models.subscription import Subscription
from app.models.task import Task
from app.models.user import User
from app.schemas.insight import InsightScenario
from app.services.cashflow_service import CashFlowService
from app.services.credit_service import CreditService
from app.services.insight_service import InsightService
from app.services.pnl_service import PnLService
from app.services.sensitivity_service import SensitivityService
from app.services.seed_service import seed_demo_account
from app.services.unit_economics_service import UnitEconomicsService
from app.services.valuation_service import ValuationService

from .conftest import auth_headers, make_user


def _configure_demo(monkeypatch, count=5):
    monkeypatch.setattr(settings, "DEMO_MODE", True)
    monkeypatch.setattr(settings, "DEMO_ACCOUNT_PASSWORD", SecretStr("DemoPass123"))
    monkeypatch.setattr(settings, "DEMO_COMPANY_COUNT", count)
    monkeypatch.setattr(settings, "AI_QUOTA_ENABLED", False)
    monkeypatch.setattr(settings, "AI_PROVIDER", "demo")


async def _count(db, model, company_id):
    return (
        await db.execute(
            select(func.count())
            .select_from(model)
            .where(model.company_id == company_id)
        )
    ).scalar_one()


async def test_demo_seed_creates_complete_portfolio_and_derived_outputs(
    db_session, monkeypatch
):
    _configure_demo(monkeypatch, count=5)

    result = await seed_demo_account(db_session)

    user = await db_session.get(User, UUID(result["user_id"]))
    organization = await db_session.get(Organization, UUID(result["organization_id"]))
    companies = list(
        (
            await db_session.execute(
                select(Company)
                .where(Company.organization_id == organization.id)
                .order_by(Company.name)
            )
        ).scalars()
    )
    assert result["company_count"] == 5
    assert organization.name == "Demo Venture Fund"
    assert organization.organization_type == "fund"
    assert user.role == "admin"
    assert user.company_id is None
    assert len(companies) == 5
    assert {company.name for company in companies} == {
        "Demo SaaS",
        "Demo Marketplace",
        "Demo FinTech",
        "Demo EdTech",
        "Demo B2B",
    }
    subscription = (
        await db_session.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
    ).scalar_one()
    assert subscription.plan == "enterprise"

    for company in companies:
        assert company.industry
        assert company.business_model
        assert company.geography
        metrics = list(
            (
                await db_session.execute(
                    select(Metric).where(Metric.company_id == company.id)
                )
            ).scalars()
        )
        assert sum(row.type == "fact" for row in metrics) == 6
        assert sum(row.type == "plan" for row in metrics) == 6
        assert await _count(db_session, Budget, company.id) == 12
        assert await _count(db_session, HiringTeam, company.id) >= 5
        assert await _count(db_session, HiringPlanRow, company.id) >= 2
        assert await _count(db_session, Cohort, company.id) == 5
        assert await _count(db_session, Financing, company.id) == 2
        assert await _count(db_session, Task, company.id) == 4

    company = companies[0]
    pnl = await PnLService(db_session).get_pnl(company.id)
    cashflow = await CashFlowService(db_session).get_cashflow(company.id)
    funding = await CreditService(db_session).forecast(company.id)
    unit_economics = await UnitEconomicsService(db_session).get_unit_economics(
        company.id
    )
    valuation = await ValuationService(db_session).get_valuation(company.id)
    sensitivity = await SensitivityService(db_session).analyze(company.id)
    assert pnl.months
    assert cashflow.months
    assert funding.months
    assert unit_economics.revenue > 0
    assert valuation.revenue_annual and valuation.revenue_annual > 0
    assert sensitivity.stresses

    _, serialized_budget, demo_text = await InsightService(db_session)._gather(
        company.id, InsightScenario.budget
    )
    payload = json.loads(serialized_budget)
    assert payload
    assert {"period", "type", "marketing", "development", "fot", "gna"} <= payload[
        0
    ].keys()
    assert "<app.models.budget.Budget object" not in serialized_budget
    assert "общие расходы" in demo_text


async def test_demo_seed_is_idempotent(db_session, monkeypatch):
    _configure_demo(monkeypatch, count=1)

    first = await seed_demo_account(db_session)
    second = await seed_demo_account(db_session)

    users = list(
        (
            await db_session.execute(
                select(User).where(User.email == settings.DEMO_ACCOUNT_EMAIL)
            )
        ).scalars()
    )
    companies = list(
        (
            await db_session.execute(
                select(Company).where(
                    Company.organization_id == UUID(second["organization_id"])
                )
            )
        ).scalars()
    )
    assert first["user_id"] == second["user_id"]
    assert len(users) == 1
    assert [company.name for company in companies] == ["Demo SaaS"]
    assert await _count(db_session, Metric, companies[0].id) == 12


async def test_demo_seed_refuses_to_reset_tenant_with_another_user(
    db_session, monkeypatch
):
    _configure_demo(monkeypatch, count=1)
    result = await seed_demo_account(db_session)
    organization_id = UUID(result["organization_id"])
    await make_user(
        db_session,
        "another-analyst@example.test",
        "observer",
        organization_id,
    )

    with pytest.raises(ValueError, match="contains another user"):
        await seed_demo_account(db_session)

    companies = list(
        (
            await db_session.execute(
                select(Company).where(Company.organization_id == organization_id)
            )
        ).scalars()
    )
    assert [company.name for company in companies] == ["Demo SaaS"]


async def test_demo_user_is_tenant_isolated_and_can_repeat_budget_ai(
    client, db_session, other_company, monkeypatch
):
    _configure_demo(monkeypatch, count=1)
    result = await seed_demo_account(db_session)
    user = await db_session.get(User, UUID(result["user_id"]))
    company_id = result["company_ids"][0]
    headers = auth_headers(user)

    companies_response = await client.get("/api/v1/companies", headers=headers)
    assert companies_response.status_code == 200
    assert [row["id"] for row in companies_response.json()] == [company_id]
    assert str(other_company.id) not in {row["id"] for row in companies_response.json()}

    responses = [
        await client.post(
            f"/api/v1/companies/{company_id}/insights/budget", headers=headers
        )
        for _ in range(3)
    ]
    assert [response.status_code for response in responses] == [200, 200, 200]
    assert all(response.json()["provider"] == "demo" for response in responses)
