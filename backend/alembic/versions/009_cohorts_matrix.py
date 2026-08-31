"""Cohorts matrix — size + retention M1-M12 + marketing_spend

Revision ID: 009_cohorts_matrix
Revises: 008_metrics_model
Create Date: 2026-08-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009_cohorts_matrix"
down_revision: Union[str, None] = "008_metrics_model"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cohorts", sa.Column("size", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("cohorts", sa.Column("marketing_spend", sa.Numeric(14, 2), nullable=True))
    for month in (2, 4, 5, 7, 8, 9, 10, 11):
        op.add_column(
            "cohorts",
            sa.Column(f"retention_m{month}", sa.Float(), nullable=False, server_default="0"),
        )


def downgrade() -> None:
    for month in (11, 10, 9, 8, 7, 5, 4, 2):
        op.drop_column("cohorts", f"retention_m{month}")
    op.drop_column("cohorts", "marketing_spend")
    op.drop_column("cohorts", "size")
