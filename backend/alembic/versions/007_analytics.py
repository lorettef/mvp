"""Analytics events table

Revision ID: 007_analytics
Revises: 006_hiring
Create Date: 2026-08-24
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007_analytics"
down_revision: Union[str, None] = "006_hiring"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.Uuid(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_analytics_events_user_id"), nullable=True),
        sa.Column("event", sa.String(100), nullable=False),
        sa.Column("properties", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_analytics_events_user_id", "analytics_events", ["user_id"])
    op.create_index("ix_analytics_events_event", "analytics_events", ["event"])


def downgrade() -> None:
    op.drop_index("ix_analytics_events_event", table_name="analytics_events")
    op.drop_index("ix_analytics_events_user_id", table_name="analytics_events")
    op.drop_table("analytics_events")
