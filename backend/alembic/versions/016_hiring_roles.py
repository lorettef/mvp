"""Hiring 2.0: current team + role-based monthly hiring plan

Revision ID: 016_hiring_roles
Revises: 015_financing_2
Create Date: 2026-09-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "016_hiring_roles"
down_revision: Union[str, None] = "015_financing_2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "hiring_team",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_hiring_team_company_id"), nullable=False),
        sa.Column("role_key", sa.String(50), nullable=False),
        sa.Column("headcount", sa.Integer(), nullable=False),
        sa.Column("salary", sa.Numeric(14, 2), nullable=False, server_default="150000.0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "role_key", name="uq_hiring_team_company_role"),
    )
    op.create_index("ix_hiring_team_company_id", "hiring_team", ["company_id"])

    op.create_table(
        "hiring_plan_rows",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("company_id", sa.Uuid(as_uuid=True), sa.ForeignKey("companies.id", ondelete="CASCADE", name="fk_hiring_plan_rows_company_id"), nullable=False),
        sa.Column("period", sa.Date(), nullable=False),
        sa.Column("role_key", sa.String(50), nullable=False),
        sa.Column("required_headcount", sa.Integer(), nullable=False),
        sa.Column("recommended_hires", sa.Integer(), nullable=False),
        sa.Column("approved_hires", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("company_id", "period", "role_key", name="uq_hiring_plan_company_period_role"),
    )
    op.create_index("ix_hiring_plan_rows_company_id", "hiring_plan_rows", ["company_id"])


def downgrade() -> None:
    op.drop_index("ix_hiring_plan_rows_company_id", table_name="hiring_plan_rows")
    op.drop_table("hiring_plan_rows")
    op.drop_index("ix_hiring_team_company_id", table_name="hiring_team")
    op.drop_table("hiring_team")
