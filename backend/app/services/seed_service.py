"""Deterministic, tenant-isolated demo portfolio provisioning."""

import logging
from datetime import date
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import hash_password
from app.core.time import today
from app.models.ai_cache import AICache
from app.models.budget import Budget
from app.models.cohort import Cohort
from app.models.company import Company
from app.models.financing import Financing
from app.models.hiring_plan import HiringPlan
from app.models.hiring_plan_row import HiringPlanRow
from app.models.hiring_settings import HiringSettings
from app.models.hiring_team import HiringTeam
from app.models.metric import Metric
from app.models.organization import Organization
from app.models.subscription import Subscription
from app.models.task import Task
from app.models.user import User
from app.models.valuation import Valuation
from app.schemas.budget import BudgetUpsert
from app.schemas.cohort import CohortUpsert
from app.schemas.company import CompanyCreate
from app.schemas.financing import FinancingCreate
from app.schemas.hiring import (
    HiringApproveItem,
    HiringApproveUpsert,
    HiringSettingsUpsert,
    HiringTeamUpsert,
)
from app.schemas.metric import MetricUpsert
from app.schemas.task import TaskCreate
from app.services.budget_service import BudgetService
from app.services.cohort_service import CohortService
from app.services.company_service import CompanyService
from app.services.financing_service import FinancingService
from app.services.hiring_service import HiringService
from app.services.metric_service import MetricService
from app.services.task_service import TaskService

logger = logging.getLogger(__name__)


DEMO_COMPANIES = (
    ("Demo SaaS", "saas", "subscription", "RU", 3_200_000, 4_900, 34, 0.965, 0.075),
    (
        "Demo Marketplace",
        "marketplaces",
        "marketplace",
        "RU",
        4_200_000,
        1_850,
        92,
        0.91,
        0.065,
    ),
    (
        "Demo FinTech",
        "fintech",
        "financial_services",
        "KZ",
        5_800_000,
        6_200,
        48,
        0.945,
        0.055,
    ),
    ("Demo EdTech", "edtech", "subscription", "RU", 1_100_000, 3_400, 41, 0.925, 0.08),
    ("Demo B2B", "other", "services", "Global", 4_800_000, 18_500, 16, 0.975, 0.045),
    (
        "Demo HealthTech",
        "healthtech",
        "subscription",
        "RU",
        3_600_000,
        7_100,
        25,
        0.955,
        0.06,
    ),
    (
        "Demo Logistics",
        "logistics",
        "marketplace",
        "KZ",
        3_900_000,
        2_600,
        61,
        0.92,
        0.05,
    ),
    (
        "Demo PropTech",
        "proptech",
        "marketplace",
        "RU",
        3_500_000,
        5_800,
        29,
        0.94,
        0.07,
    ),
    ("Demo Media", "media", "mobile_app", "Global", 2_400_000, 990, 118, 0.89, 0.085),
    (
        "Demo ClimateTech",
        "cleantech",
        "services",
        "Global",
        4_600_000,
        22_000,
        12,
        0.98,
        0.04,
    ),
)

_COMPANY_CHILD_MODELS = (
    Task,
    HiringPlanRow,
    HiringPlan,
    HiringSettings,
    HiringTeam,
    Financing,
    Valuation,
    Metric,
    Cohort,
    Budget,
)


def _add_months(period: date, months: int) -> date:
    zero_based = period.month - 1 + months
    return date(period.year + zero_based // 12, zero_based % 12 + 1, 1)


async def _reset_demo_portfolio(db: AsyncSession, organization_id: UUID) -> None:
    """Delete only data owned by the dedicated demo tenant.

    Explicit child deletes keep the reset deterministic under the SQLite test
    setup, where foreign-key cascades are not enabled. Production PostgreSQL
    has the same ownership boundary plus FK cascades.
    """
    company_ids = list(
        (
            await db.execute(
                select(Company.id).where(Company.organization_id == organization_id)
            )
        ).scalars()
    )
    if not company_ids:
        return

    await db.execute(
        update(User)
        .where(User.organization_id == organization_id)
        .values(company_id=None)
    )
    for model in _COMPANY_CHILD_MODELS:
        await db.execute(delete(model).where(model.company_id.in_(company_ids)))
    await db.execute(delete(Company).where(Company.id.in_(company_ids)))
    await db.flush()


async def _assert_demo_tenant_safe(
    db: AsyncSession, user: User, organization: Organization
) -> None:
    """Fail closed before resetting anything that may be real tenant data."""
    other_user = (
        await db.execute(
            select(User.id).where(
                User.organization_id == organization.id,
                User.id != user.id,
            )
        )
    ).scalars().first()
    if other_user is not None:
        raise ValueError("Demo tenant contains another user; refusing to reset it")

    existing_names = set(
        (
            await db.execute(
                select(Company.name).where(Company.organization_id == organization.id)
            )
        ).scalars()
    )
    allowed_names = {template[0] for template in DEMO_COMPANIES} | {"SaaSify Inc."}
    if not existing_names <= allowed_names:
        raise ValueError("Demo tenant contains non-demo companies; refusing to reset it")


async def _ensure_demo_identity(db: AsyncSession) -> tuple[User, Organization]:
    password = (
        settings.DEMO_ACCOUNT_PASSWORD.get_secret_value()
        if settings.DEMO_ACCOUNT_PASSWORD is not None
        else ""
    )
    if not password:
        raise ValueError("DEMO_ACCOUNT_PASSWORD is required")

    user = (
        await db.execute(select(User).where(User.email == settings.DEMO_ACCOUNT_EMAIL))
    ).scalar_one_or_none()

    if user is None:
        organization = Organization(
            name=settings.DEMO_ORGANIZATION_NAME,
            organization_type="fund",
        )
        db.add(organization)
        await db.flush()
        user = User(email=settings.DEMO_ACCOUNT_EMAIL, password_hash="pending")
        db.add(user)
        await db.flush()
    else:
        organization = (
            await db.get(Organization, user.organization_id)
            if user.organization_id is not None
            else None
        )
        # Permit an in-place upgrade from the repository's former demo seed,
        # but never take over an arbitrary real account with the configured email.
        if organization is None or organization.name not in {
            settings.DEMO_ORGANIZATION_NAME,
            "Demo Accelerator",
        }:
            raise ValueError("DEMO_ACCOUNT_EMAIL belongs to a non-demo tenant")
        organization.name = settings.DEMO_ORGANIZATION_NAME
        organization.organization_type = "fund"

    await _assert_demo_tenant_safe(db, user, organization)

    user.password_hash = hash_password(password)
    user.full_name = "Demo Fund Analyst"
    user.company_name = settings.DEMO_ORGANIZATION_NAME
    user.role = "admin"
    user.organization_id = organization.id
    user.company_id = None
    user.is_active = True

    subscription = (
        (await db.execute(select(Subscription).where(Subscription.user_id == user.id)))
        .scalars()
        .first()
    )
    if subscription is None:
        subscription = Subscription(user_id=user.id)
        db.add(subscription)
    # Existing unlimited plan, scoped only to this deterministic demo user.
    subscription.plan = "enterprise"
    subscription.status = "active"
    subscription.used_today = 0
    subscription.used_date = date(1970, 1, 1)
    await db.execute(delete(AICache).where(AICache.user_id == user.id))
    await db.flush()
    return user, organization


async def _seed_company_data(
    db: AsyncSession,
    company: Company,
    template: tuple,
    index: int,
) -> None:
    _, _, _, _, base_revenue, base_arpu, base_units, retention, growth = template
    current_month = today().replace(day=1)
    fact_periods = [_add_months(current_month, offset) for offset in range(-5, 1)]
    plan_periods = [_add_months(current_month, offset) for offset in range(1, 7)]

    metric_service = MetricService(db)
    budget_service = BudgetService(db)
    cohort_service = CohortService(db)
    hiring_service = HiringService(db)
    financing_service = FinancingService(db)
    task_service = TaskService(db)

    facts: list[MetricUpsert] = []
    for month_index, period in enumerate(fact_periods):
        factor = (1 + growth) ** month_index
        facts.append(
            MetricUpsert(
                period=period,
                type="fact",
                new_units=base_units + month_index * (2 + index % 3),
                arpu=round(base_arpu * (1 + 0.006 * month_index), 2),
                revenue=round(base_revenue * factor, 2),
                marketing_spend=round(
                    base_revenue * factor * (0.10 + index * 0.002), 2
                ),
                retention_rate=min(0.995, retention + month_index * 0.002),
                comment="Demo historical Fact",
            )
        )
    await metric_service.bulk_upsert(company.id, facts)

    latest_fact_revenue = facts[-1].revenue
    plans: list[MetricUpsert] = []
    for month_index, period in enumerate(plan_periods, start=1):
        factor = (1 + growth * 1.08) ** month_index
        plans.append(
            MetricUpsert(
                period=period,
                type="plan",
                new_units=base_units + 12 + month_index * (3 + index % 2),
                arpu=round(base_arpu * (1.04 + 0.008 * month_index), 2),
                revenue=round(latest_fact_revenue * factor, 2),
                marketing_spend=round(latest_fact_revenue * factor * 0.105, 2),
                retention_rate=min(0.995, retention + 0.012 + month_index * 0.001),
                comment="Demo future Plan",
            )
        )
    await metric_service.bulk_upsert(company.id, plans)

    team = (
        ("backend", 2 + index % 2, 210_000 + index * 3_000),
        ("frontend", 1 + (index + 1) % 2, 195_000 + index * 2_500),
        ("sales_manager", 2 + index % 3, 145_000 + index * 2_000),
        ("marketing", 1, 150_000 + index * 1_500),
        ("management", 1, 240_000 + index * 4_000),
    )
    for role_key, headcount, salary in team:
        await hiring_service.upsert_team(
            company.id,
            HiringTeamUpsert(role_key=role_key, headcount=headcount, salary=salary),
        )
    await hiring_service.upsert_settings(company.id, HiringSettingsUpsert())
    await hiring_service.approve_plan(
        company.id,
        HiringApproveUpsert(
            items=[
                HiringApproveItem(
                    period=plan_periods[0], role_key="sales_manager", approved_hires=1
                ),
                HiringApproveItem(
                    period=plan_periods[2], role_key="backend", approved_hires=1
                ),
            ]
        ),
    )

    # budget.fot is derived from the same current-team assumptions used by
    # HiringTeam; it is not a separate demo payroll model.
    base_fot = sum(headcount * salary for _, headcount, salary in team)
    for month_index, (period, metric) in enumerate(zip(fact_periods, facts)):
        await budget_service.upsert_budget(
            company.id,
            BudgetUpsert(
                period=period,
                type="fact",
                marketing=round(metric.revenue * 0.10, 2),
                development=round(metric.revenue * (0.075 + index * 0.002), 2),
                fot=round(base_fot * (0.97 + month_index * 0.006), 2),
                gna=round(metric.revenue * 0.055, 2),
            ),
        )
    for month_index, (period, metric) in enumerate(zip(plan_periods, plans), start=1):
        approved_salary = team[2][2]
        if month_index >= 3:
            approved_salary += team[0][2]
        await budget_service.upsert_budget(
            company.id,
            BudgetUpsert(
                period=period,
                type="plan",
                marketing=round(metric.revenue * 0.105, 2),
                development=round(metric.revenue * (0.08 + index * 0.002), 2),
                fot=round(base_fot * 1.01 + approved_salary, 2),
                gna=round(metric.revenue * 0.06, 2),
            ),
        )

    for cohort_index, period in enumerate(fact_periods[-4:]):
        cohort_retention = max(0.45, retention - 0.08)
        await cohort_service.upsert_cohort(
            company.id,
            CohortUpsert(
                period=period,
                type="fact",
                size=base_units + cohort_index * 5,
                retention_m1=cohort_retention,
                retention_m2=max(0.0, cohort_retention - 0.07),
                retention_m3=max(0.0, cohort_retention - 0.12),
                retention_m4=max(0.0, cohort_retention - 0.16),
                marketing_spend=round(base_revenue * 0.08, 2),
            ),
        )
    await cohort_service.upsert_cohort(
        company.id,
        CohortUpsert(
            period=plan_periods[0],
            type="plan",
            size=base_units + 30,
            retention_m1=min(0.99, retention),
            retention_m2=min(0.98, retention - 0.04),
            retention_m3=min(0.97, retention - 0.08),
            marketing_spend=round(latest_fact_revenue * 0.09, 2),
        ),
    )

    await financing_service.create_financing(
        company.id,
        FinancingCreate(
            type="investment",
            investor_type="fund",
            counterparty_name=settings.DEMO_ORGANIZATION_NAME,
            amount=4_000_000 + index * 500_000,
            issued_date=fact_periods[0],
            notes="Demo seed investment",
        ),
    )
    await financing_service.create_financing(
        company.id,
        FinancingCreate(
            type="loan",
            counterparty_name="Demo Bank",
            amount=900_000 + index * 100_000,
            issued_date=fact_periods[3],
            annual_rate=15.0 + index * 0.4,
            term_months=24,
            repayment_type="annuity",
            first_payment_date=_add_months(fact_periods[3], 1),
            notes="Demo seed working-capital loan",
        ),
    )

    tasks = (
        ("Проверить unit economics", "metrics", "done", "medium"),
        ("Обновить финансовую модель", "documents", "in_progress", "high"),
        ("Подготовить investor update", "presentation", "pending", "high"),
        ("Согласовать data room", "negotiations", "pending", "medium"),
    )
    for task_index, (title, stage, task_status, priority) in enumerate(tasks):
        await task_service.create_task(
            company.id,
            TaskCreate(
                title=title,
                description=f"Демонстрационная задача для {company.name}",
                stage=stage,
                status=task_status,
                due_date=_add_months(current_month, task_index + 1),
                source="manual",
                priority=priority,
            ),
        )


async def seed_demo_account(db: AsyncSession) -> dict:
    """Create or deterministically reset the isolated demo tenant."""
    user, organization = await _ensure_demo_identity(db)
    await _reset_demo_portfolio(db, organization.id)

    company_service = CompanyService(db)
    company_count = settings.DEMO_COMPANY_COUNT
    await company_service.enforce_company_limit(organization.id, "enterprise")

    company_ids: list[str] = []
    for index, template in enumerate(DEMO_COMPANIES[:company_count]):
        name, industry, business_model, geography, *_ = template
        company = await company_service.create_company(
            organization.id,
            CompanyCreate(
                name=name,
                industry=industry,
                geography=geography,
                gross_margin=max(0.48, 0.78 - index * 0.025),
                business_model=business_model,
                selected_metrics=[
                    "new_units",
                    "arpu",
                    "revenue",
                    "marketing_spend",
                    "retention_rate",
                ],
            ),
        )
        await _seed_company_data(db, company, template, index)
        company_ids.append(str(company.id))

    user.company_id = None
    await db.flush()
    logger.info(
        "Demo tenant provisioned: organization_id=%s companies=%s",
        organization.id,
        len(company_ids),
    )
    return {
        "email": user.email,
        "user_id": str(user.id),
        "organization_id": str(organization.id),
        "company_count": len(company_ids),
        "company_ids": company_ids,
    }
