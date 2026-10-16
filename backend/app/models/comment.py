import uuid

from sqlalchemy import (
    CheckConstraint,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    Uuid,
)
from sqlalchemy.sql import func

from app.core.database import Base
from app.core.time import utcnow


class Comment(Base):
    __tablename__ = "comments"
    __table_args__ = (
        CheckConstraint(
            "(target_type = 'overview' AND metric_id IS NULL AND field IS NULL AND indicator_key IS NULL AND target_period IS NULL AND target_scenario IS NULL) OR "
            "(target_type = 'metric_value' AND metric_id IS NOT NULL AND field IS NOT NULL AND indicator_key IS NULL AND target_period IS NULL AND target_scenario IS NULL) OR "
            "(target_type = 'unit_economics' AND metric_id IS NULL AND field IS NULL AND indicator_key IS NOT NULL)",
            name="ck_comments_target_shape",
        ),
        Index(
            "ix_comments_company_target_created",
            "company_id",
            "target_type",
            "created_at",
        ),
        Index("ix_comments_metric_field", "metric_id", "field"),
        Index(
            "ix_comments_ue_target",
            "company_id",
            "indicator_key",
            "target_period",
            "target_scenario",
        ),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id = Column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    target_type = Column(String(32), nullable=False)
    metric_id = Column(
        Uuid(as_uuid=True), ForeignKey("metrics.id", ondelete="CASCADE"), nullable=True
    )
    field = Column(String(64), nullable=True)
    indicator_key = Column(String(64), nullable=True)
    target_period = Column(Date, nullable=True)
    target_scenario = Column(String(8), nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(
        DateTime, nullable=False, default=utcnow, server_default=func.now()
    )
