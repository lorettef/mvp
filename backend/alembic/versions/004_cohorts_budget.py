"""Cohorts + Budgets tables

Revision ID: 004_cohorts_budget
Revises: 003_multi_tenancy
Create Date: 2026-08-17
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004_cohorts_budget"
down_revision: Union[str, None] = "003_multi_tenancy"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cohorts",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_cohorts_company_id"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("retention_m1", sa.Float(), nullable=False),
        sa.Column("retention_m3", sa.Float(), nullable=False),
        sa.Column("retention_m6", sa.Float(), nullable=False),
        sa.Column("retention_m12", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "period", "type", name="uq_cohort_company_period_type"),
    )
    op.create_index("ix_cohorts_company_id", "cohorts", ["company_id"])

    op.create_table(
        "budgets",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_budgets_company_id"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("marketing", sa.Numeric(14, 2), nullable=False),
        sa.Column("development", sa.Numeric(14, 2), nullable=False),
        sa.Column("fot", sa.Numeric(14, 2), nullable=False),
        sa.Column("gna", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "period", "type", name="uq_budget_company_period_type"),
    )
    op.create_index("ix_budgets_company_id", "budgets", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_budgets_company_id", table_name="budgets")
    op.drop_table("budgets")
    op.drop_index("ix_cohorts_company_id", table_name="cohorts")
    op.drop_table("cohorts")
