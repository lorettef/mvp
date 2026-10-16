"""Immutable Fund review corrections, separate from startup sources.

Revision ID: 019_corrections
Revises: 018_comments
"""

from alembic import op
import sqlalchemy as sa

revision = "019_corrections"
down_revision = "018_comments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "corrections",
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
        sa.Column("source_metric_id", sa.Uuid()),
        sa.Column("source_updated_at", sa.DateTime()),
        sa.Column("original_value", sa.Numeric(28, 12), nullable=False),
        sa.Column("corrected_value", sa.Numeric(28, 12), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()
        ),
        sa.CheckConstraint(
            "(target_type = 'metric_value' AND metric_id IS NOT NULL AND field IS NOT NULL AND indicator_key IS NULL AND target_period IS NULL AND target_scenario IS NULL) OR "
            "(target_type = 'unit_economics' AND metric_id IS NULL AND field IS NULL AND indicator_key IS NOT NULL AND "
            "((target_period IS NULL AND target_scenario IS NULL) OR (target_period IS NOT NULL AND target_scenario IS NOT NULL)))",
            name="ck_corrections_target_shape",
        ),
    )
    op.create_index(
        "ix_corrections_company_target_created",
        "corrections",
        ["company_id", "target_type", "created_at"],
    )
    op.create_index(
        "ix_corrections_metric_field", "corrections", ["metric_id", "field"]
    )
    op.create_index(
        "ix_corrections_ue_target",
        "corrections",
        ["company_id", "indicator_key", "target_period", "target_scenario"],
    )


def downgrade() -> None:
    op.drop_index("ix_corrections_ue_target", table_name="corrections")
    op.drop_index("ix_corrections_metric_field", table_name="corrections")
    op.drop_index("ix_corrections_company_target_created", table_name="corrections")
    op.drop_table("corrections")
