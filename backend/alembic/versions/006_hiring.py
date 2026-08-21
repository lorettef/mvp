"""Hiring plan + social payment settings tables

Revision ID: 006_hiring
Revises: 005_tasks
Create Date: 2026-08-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006_hiring"
down_revision: Union[str, None] = "005_tasks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hiring_plans",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_hiring_plans_company_id"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("dev_count", sa.Integer(), nullable=False),
        sa.Column("sales_count", sa.Integer(), nullable=False),
        sa.Column("marketing_count", sa.Integer(), nullable=False),
        sa.Column("total_fot", sa.Numeric(14, 2), nullable=True),
        sa.Column("social_payments", sa.Numeric(14, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "period", name="uq_hiring_company_period"),
    )
    op.create_index("ix_hiring_plans_company_id", "hiring_plans", ["company_id"])

    op.create_table(
        "hiring_settings",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_hiring_settings_company_id"), nullable=False),
        sa.Column("ndfl_rate", sa.Float(), nullable=False),
        sa.Column("insurance_rate", sa.Float(), nullable=False),
        sa.Column("injury_rate", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_hiring_settings_company_id", "hiring_settings", ["company_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_hiring_settings_company_id", table_name="hiring_settings")
    op.drop_table("hiring_settings")
    op.drop_index("ix_hiring_plans_company_id", table_name="hiring_plans")
    op.drop_table("hiring_plans")
