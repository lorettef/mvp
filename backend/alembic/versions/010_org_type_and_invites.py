"""Organization type + invites — separate entry for VCs and startups

Revision ID: 010_org_type_and_invites
Revises: 009_cohorts_matrix
Create Date: 2026-09-02
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010_org_type_and_invites"
down_revision: Union[str, None] = "009_cohorts_matrix"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # organization_type: "fund" | "startup" — раздельный вход для фондов и стартапов
    op.add_column(
        "organizations",
        sa.Column("organization_type", sa.String(20), nullable=False, server_default="fund"),
    )

    op.create_table(
        "invites",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("organization_id", sa.Uuid(as_uuid=True), sa.ForeignKey("organizations.id", ondelete="CASCADE", name="fk_invites_organization_id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("token", name="uq_invites_token"),
    )
    op.create_index("ix_invites_organization_id", "invites", ["organization_id"])
    op.create_index("ix_invites_token", "invites", ["token"])


def downgrade() -> None:
    op.drop_table("invites")
    op.drop_column("organizations", "organization_type")
