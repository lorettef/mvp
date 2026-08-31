from sqlalchemy import Column, String, DateTime, Float, ForeignKey, UniqueConstraint, Numeric, Date, Integer, Text
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Metric(Base):
    __tablename__ = "metrics"
    __table_args__ = (
        UniqueConstraint("company_id", "period", "type", name="uq_metric_company_period_type"),
    )
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    period = Column(Date, nullable=False)
    type = Column(String(20), nullable=False)  # plan, fact
    new_units = Column(Integer, nullable=False, default=0)
    arpu = Column(Numeric(14, 2), nullable=True)
    revenue = Column(Numeric(14, 2), nullable=False)
    marketing_spend = Column(Numeric(14, 2), nullable=False, default=0)
    retention_rate = Column(Float, nullable=False, default=1.0)  # 0..1
    churn = Column(Float, nullable=False)  # 0..1, derived = 1 - retention_rate
    ltv = Column(Numeric(14, 2), nullable=False)
    cac = Column(Numeric(14, 2), nullable=False)
    active_units = Column(Integer, nullable=True)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
