"""Fund review comments, separate from canonical financial sources.

Revision ID: 018_comments
Revises: 017_budget_cogs
"""

from alembic import op
import sqlalchemy as sa

revision = "018_comments"
down_revision = "017_budget_cogs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comments",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "company_id",
            sa.Uuid(),
            sa.ForeignKey("companies.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("target_type", sa.String(32), nullable=False),
        sa.Column(
            "metric_id", sa.Uuid(), sa.ForeignKey("metrics.id", ondelete="CASCADE")
        ),
        sa.Column("field", sa.String(64)),
        sa.Column("indicator_key", sa.String(64)),
        sa.Column("target_period", sa.Date()),
        sa.Column("target_scenario", sa.String(8)),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "(target_type = 'overview' AND metric_id IS NULL AND field IS NULL AND indicator_key IS NULL AND target_period IS NULL AND target_scenario IS NULL) OR "
            "(target_type = 'metric_value' AND metric_id IS NOT NULL AND field IS NOT NULL AND indicator_key IS NULL AND target_period IS NULL AND target_scenario IS NULL) OR "
            "(target_type = 'unit_economics' AND metric_id IS NULL AND field IS NULL AND indicator_key IS NOT NULL)",
            name="ck_comments_target_shape",
        ),
    )
    op.create_index(
        "ix_comments_company_target_created",
        "comments",
        ["company_id", "target_type", "created_at"],
    )
    op.create_index("ix_comments_metric_field", "comments", ["metric_id", "field"])
    op.create_index(
        "ix_comments_ue_target",
        "comments",
        ["company_id", "indicator_key", "target_period", "target_scenario"],
    )


def downgrade() -> None:
    op.drop_index("ix_comments_ue_target", table_name="comments")
    op.drop_index("ix_comments_metric_field", table_name="comments")
    op.drop_index("ix_comments_company_target_created", table_name="comments")
    op.drop_table("comments")
