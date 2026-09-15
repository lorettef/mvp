"""Financing 2.0: investment/loan domain, dates, annual_rate in percent

Revision ID: 015_financing_2
Revises: 014_ai_usage_counter
Create Date: 2026-09-15
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "015_financing_2"
down_revision: Union[str, None] = "014_ai_usage_counter"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("financing") as batch_op:
        batch_op.alter_column(
            "rate",
            new_column_name="annual_rate",
            existing_type=sa.Float(),
            existing_nullable=True,
        )
    op.add_column("financing", sa.Column("investor_type", sa.String(20), nullable=True))
    op.add_column("financing", sa.Column("counterparty_name", sa.String(255), nullable=True))
    op.add_column("financing", sa.Column("currency", sa.String(3), nullable=False, server_default="RUB"))
    op.add_column("financing", sa.Column("issued_date", sa.Date(), nullable=True))
    op.add_column("financing", sa.Column("term_months", sa.Integer(), nullable=True))
    op.add_column("financing", sa.Column("repayment_type", sa.String(20), nullable=True))
    op.add_column("financing", sa.Column("first_payment_date", sa.Date(), nullable=True))
    op.add_column("financing", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("financing", sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()))

    op.execute("UPDATE financing SET annual_rate = annual_rate * 100 WHERE annual_rate IS NOT NULL")
    op.execute("UPDATE financing SET type = 'loan' WHERE type = 'credit'")


def downgrade() -> None:
    op.execute("UPDATE financing SET type = 'credit' WHERE type = 'loan'")
    op.execute("UPDATE financing SET annual_rate = annual_rate / 100 WHERE annual_rate IS NOT NULL")

    with op.batch_alter_table("financing") as batch_op:
        batch_op.drop_column("updated_at")
        batch_op.drop_column("notes")
        batch_op.drop_column("first_payment_date")
        batch_op.drop_column("repayment_type")
        batch_op.drop_column("term_months")
        batch_op.drop_column("issued_date")
        batch_op.drop_column("currency")
        batch_op.drop_column("counterparty_name")
        batch_op.drop_column("investor_type")
        batch_op.alter_column(
            "annual_rate",
            new_column_name="rate",
            existing_type=sa.Float(),
            existing_nullable=True,
        )
