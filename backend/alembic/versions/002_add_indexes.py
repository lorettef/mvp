"""Add indexes on subscriptions.user_id and ai_cache(user_id, created_at)

Revision ID: 002
Revises: 001
Create Date: 2026-07-09
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '002'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index("ix_ai_cache_user_created", "ai_cache", ["user_id", "created_at"])

def downgrade() -> None:
    op.drop_index("ix_ai_cache_user_created", table_name="ai_cache")
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
