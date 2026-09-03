from sqlalchemy import Column, String, DateTime, Float, Integer, Numeric, ForeignKey, UniqueConstraint, Date
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Cohort(Base):
    __tablename__ = "cohorts"
    __table_args__ = (
        UniqueConstraint("company_id", "period", "type", name="uq_cohort_company_period_type"),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    period = Column(Date, nullable=False)
    type = Column(String(20), nullable=False)
    size = Column(Integer, nullable=False, server_default="1")
    retention_m1 = Column(Float, nullable=True)
    retention_m2 = Column(Float, nullable=True)
    retention_m3 = Column(Float, nullable=True)
    retention_m4 = Column(Float, nullable=True)
    retention_m5 = Column(Float, nullable=True)
    retention_m6 = Column(Float, nullable=True)
    retention_m7 = Column(Float, nullable=True)
    retention_m8 = Column(Float, nullable=True)
    retention_m9 = Column(Float, nullable=True)
    retention_m10 = Column(Float, nullable=True)
    retention_m11 = Column(Float, nullable=True)
    retention_m12 = Column(Float, nullable=True)
    marketing_spend = Column(Numeric(14, 2), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
