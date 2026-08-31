"""Metrics model migration: mrr→revenue + metriki.md fields + company.gross_margin

Revision ID: 008_metrics_model
Revises: 007_analytics
Create Date: 2026-09-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008_metrics_model"
down_revision: Union[str, None] = "007_analytics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. metrics: rename mrr → revenue (values preserved via RENAME COLUMN)
    op.alter_column(
        "metrics",
        "mrr",
        new_column_name="revenue",
        existing_type=sa.Numeric(14, 2),
        existing_nullable=False,
    )

    # 2. metrics: drop manual-input columns no longer part of metriki.md model
    op.drop_column("metrics", "runway_months")
    op.drop_column("metrics", "stage")

    # 3. metrics: add unit-economics input columns
    op.add_column(
        "metrics", sa.Column("new_units", sa.Integer(), nullable=False, server_default="0")
    )
    op.add_column(
        "metrics",
        sa.Column("marketing_spend", sa.Numeric(14, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "metrics", sa.Column("retention_rate", sa.Float(), nullable=False, server_default="1")
    )
    op.add_column("metrics", sa.Column("active_units", sa.Integer(), nullable=True))
    op.add_column("metrics", sa.Column("comment", sa.Text(), nullable=True))

    # 4. backfill: retention_rate is derived from existing churn (1 − churn)
    op.execute("UPDATE metrics SET retention_rate = 1 - churn")

    # 5. companies: add gross_margin (default 75%) for Payback/ROMI computation
    op.add_column(
        "companies",
        sa.Column("gross_margin", sa.Float(), nullable=False, server_default="0.75"),
    )


def downgrade() -> None:
    # companies: drop gross_margin
    op.drop_column("companies", "gross_margin")

    # metrics: drop new columns
    op.drop_column("metrics", "active_units")
    op.drop_column("metrics", "comment")
    op.drop_column("metrics", "retention_rate")
    op.drop_column("metrics", "marketing_spend")
    op.drop_column("metrics", "new_units")

    # metrics: restore dropped manual-input columns
    op.add_column("metrics", sa.Column("runway_months", sa.Float(), nullable=True))
    op.add_column("metrics", sa.Column("stage", sa.String(50), nullable=True))

    # metrics: rename revenue → mrr
    op.alter_column(
        "metrics",
        "revenue",
        new_column_name="mrr",
        existing_type=sa.Numeric(14, 2),
        existing_nullable=False,
    )
