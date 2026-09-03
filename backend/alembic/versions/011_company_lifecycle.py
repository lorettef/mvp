"""Company business_model + archived_at; cohort retention M1-M12 nullable

Revision ID: 011_company_lifecycle
Revises: 010_org_type_and_invites
Create Date: 2026-09-03
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011_company_lifecycle"
down_revision: Union[str, None] = "010_org_type_and_invites"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# retention columns that were added with server_default="0" in 009_cohorts_matrix
_WITH_DEFAULT = (2, 4, 5, 7, 8, 9, 10, 11)


def upgrade() -> None:
    # companies: business_model + archived_at (company lifecycle)
    op.add_column("companies", sa.Column("business_model", sa.String(50), nullable=True))
    op.add_column("companies", sa.Column("archived_at", sa.DateTime(), nullable=True))

    # cohorts: retention M1-M12 become nullable; drop server_default where present.
    # batch mode is required because SQLite cannot ALTER COLUMN DROP NOT NULL.
    with op.batch_alter_table("cohorts") as batch_op:
        for month in range(1, 13):
            column = f"retention_m{month}"
            if month in _WITH_DEFAULT:
                batch_op.alter_column(column, nullable=True, server_default=None)
            else:
                batch_op.alter_column(column, nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("cohorts") as batch_op:
        for month in range(1, 13):
            column = f"retention_m{month}"
            if month in _WITH_DEFAULT:
                batch_op.alter_column(column, nullable=False, server_default="0")
            else:
                batch_op.alter_column(column, nullable=False)

    op.drop_column("companies", "archived_at")
    op.drop_column("companies", "business_model")
