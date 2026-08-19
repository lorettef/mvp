from sqlalchemy import Column, DateTime, Integer, ForeignKey, UniqueConstraint, Numeric, Date
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class HiringPlan(Base):
    __tablename__ = "hiring_plans"
    __table_args__ = (
        UniqueConstraint("company_id", "period", name="uq_hiring_company_period"),
    )
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    period = Column(Date, nullable=False)
    dev_count = Column(Integer, nullable=False, default=0)
    sales_count = Column(Integer, nullable=False, default=0)
    marketing_count = Column(Integer, nullable=False, default=0)
    total_fot = Column(Numeric(14, 2), nullable=True)
    social_payments = Column(Numeric(14, 2), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
