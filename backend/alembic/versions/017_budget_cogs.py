"""Explicit nullable Budget COGS; legacy values remain unknown.

Revision ID: 017_budget_cogs
Revises: 016_hiring_roles
"""

from alembic import op
import sqlalchemy as sa

revision = "017_budget_cogs"
down_revision = "016_hiring_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("budgets", sa.Column("cogs", sa.Numeric(14, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("budgets", "cogs")
