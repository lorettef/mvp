"""AI usage counter on subscriptions

Revision ID: 014_ai_usage_counter
Revises: 013_task_ai_fields
Create Date: 2026-09-08
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "014_ai_usage_counter"
down_revision: Union[str, None] = "013_task_ai_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("used_today", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "subscriptions",
        sa.Column("used_date", sa.Date(), nullable=False, server_default="1970-01-01"),
    )


def downgrade() -> None:
    op.drop_column("subscriptions", "used_date")
    op.drop_column("subscriptions", "used_today")
