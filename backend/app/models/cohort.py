from sqlalchemy import Column, String, DateTime, Float, ForeignKey, UniqueConstraint, Date
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
    retention_m1 = Column(Float, nullable=False)
    retention_m3 = Column(Float, nullable=False)
    retention_m6 = Column(Float, nullable=False)
    retention_m12 = Column(Float, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
