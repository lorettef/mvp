"""Multi-tenancy data model foundation + RBAC

Revision ID: 003_multi_tenancy
Revises: 002
Create Date: 2026-08-14
"""
from typing import Sequence, Union
import uuid
from alembic import op
import sqlalchemy as sa

revision: str = "003_multi_tenancy"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # 1. organizations
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )

    # 2. companies (без FK к users — порядок безопасен)
    op.create_table(
        "companies",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("organization_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE", name="fk_companies_organization_id"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("geography", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("organization_id", "name", name="uq_company_org_name"),
    )
    op.create_index("ix_companies_organization_id", "companies", ["organization_id"])

    # 3. добавляем колонки к users
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="company"))
    op.add_column("users", sa.Column("organization_id", sa.Uuid(as_uuid=True), nullable=True))
    op.add_column("users", sa.Column("company_id", sa.Uuid(as_uuid=True), nullable=True))

    op.create_foreign_key(
        "fk_users_organization_id",
        "users",
        "organizations",
        ["organization_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_users_company_id",
        "users",
        "companies",
        ["company_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_users_company_id", "users", ["company_id"])

    # 4. metrics, hiring_plans, financing, valuations
    op.create_table(
        "metrics",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_metrics_company_id"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("mrr", sa.Numeric(14, 2), nullable=False),
        sa.Column("cac", sa.Numeric(14, 2), nullable=False),
        sa.Column("ltv", sa.Numeric(14, 2), nullable=False),
        sa.Column("churn", sa.Float(), nullable=False),
        sa.Column("arpu", sa.Numeric(14, 2), nullable=True),
        sa.Column("runway_months", sa.Float(), nullable=True),
        sa.Column("stage", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "period", "type", name="uq_metric_company_period_type"),
    )
    op.create_index("ix_metrics_company_id", "metrics", ["company_id"])

    op.create_table(
        "hiring_plans",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_hiring_plans_company_id"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("dev_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sales_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("marketing_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_fot", sa.Numeric(14, 2), nullable=True),
        sa.Column("social_payments", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "period", name="uq_hiring_company_period"),
    )
    op.create_index("ix_hiring_plans_company_id", "hiring_plans", ["company_id"])

    op.create_table(
        "financing",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_financing_company_id"), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("rate", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_financing_company_id", "financing", ["company_id"])

    op.create_table(
        "valuations",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_valuations_company_id"), nullable=False),
        sa.Column("fcf", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount_rate", sa.Float(), nullable=False),
        sa.Column("growth_rate", sa.Float(), nullable=False),
        sa.Column("equity_value", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_valuations_company_id", "valuations", ["company_id"])

    # 6. Data migration: для каждого существующего пользователя создаём организацию
    # и компанию, затем назначаем роль admin и привязки.
    # WHERE organization_id IS NULL — идемпотентно при повторном запуске.
    rows = bind.execute(
        sa.text("SELECT id, company_name, email, full_name FROM users WHERE organization_id IS NULL")
    ).fetchall()

    for row in rows:
        user_id = row.id
        org_id = uuid.uuid4()
        org_name = row.company_name or row.email or "Accelerator"
        bind.execute(
            sa.text(
                "INSERT INTO organizations (id, name, created_at) "
                "VALUES (:id, :name, NOW())"
            ),
            {"id": org_id, "name": org_name},
        )

        company_id = uuid.uuid4()
        company_name = row.company_name or row.full_name or "Компания"
        bind.execute(
            sa.text(
                "INSERT INTO companies (id, organization_id, name, industry, geography, created_at) "
                "VALUES (:id, :organization_id, :name, NULL, NULL, NOW())"
            ),
            {"id": company_id, "organization_id": org_id, "name": company_name},
        )

        bind.execute(
            sa.text(
                "UPDATE users SET role = 'admin', organization_id = :organization_id, "
                "company_id = :company_id WHERE id = :id"
            ),
            {"organization_id": org_id, "company_id": company_id, "id": user_id},
        )


def downgrade() -> None:
    # Сначала индексы и FK колонок users
    op.drop_index("ix_users_company_id", table_name="users")
    op.drop_index("ix_users_organization_id", table_name="users")
    op.drop_constraint("fk_users_company_id", "users", type_="foreignkey")
    op.drop_constraint("fk_users_organization_id", "users", type_="foreignkey")
    op.drop_column("users", "company_id")
    op.drop_column("users", "organization_id")
    op.drop_column("users", "role")

    # Таблицы в обратном порядке зависимостей
    op.drop_table("valuations")
    op.drop_table("financing")
    op.drop_table("hiring_plans")
    op.drop_table("metrics")
    op.drop_table("companies")
    op.drop_table("organizations")
