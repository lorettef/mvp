"""Company selected_metrics (user-chosen metric set from onboarding)

Revision ID: 012_company_selected_metrics
Revises: 011_company_lifecycle
Create Date: 2026-09-04
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "012_company_selected_metrics"
down_revision: Union[str, None] = "011_company_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("companies", sa.Column("selected_metrics", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("companies", "selected_metrics")
