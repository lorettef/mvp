from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint, Date
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class HiringPlanRow(Base):
    """План найма по ролям за месяц: required / recommended / approved."""

    __tablename__ = "hiring_plan_rows"
    __table_args__ = (
        UniqueConstraint("company_id", "period", "role_key", name="uq_hiring_plan_company_period_role"),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    period = Column(Date, nullable=False)
    role_key = Column(String(50), nullable=False)
    required_headcount = Column(Integer, nullable=False, default=0)
    recommended_hires = Column(Integer, nullable=False, default=0)
    approved_hires = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
