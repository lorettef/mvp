"""Task AI fields: source, metric, priority

Revision ID: 013_task_ai_fields
Revises: 012_company_selected_metrics
Create Date: 2026-09-07
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013_task_ai_fields"
down_revision: Union[str, None] = "012_company_selected_metrics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tasks",
        sa.Column("source", sa.String(30), nullable=False, server_default="manual"),
    )
    op.add_column("tasks", sa.Column("metric", sa.String(50), nullable=True))
    op.add_column("tasks", sa.Column("priority", sa.String(10), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "priority")
    op.drop_column("tasks", "metric")
    op.drop_column("tasks", "source")
