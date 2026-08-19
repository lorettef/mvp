from sqlalchemy import Column, String, DateTime, Float, ForeignKey, UniqueConstraint, Numeric, Date
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
    mrr = Column(Numeric(14, 2), nullable=False)
    cac = Column(Numeric(14, 2), nullable=False)
    ltv = Column(Numeric(14, 2), nullable=False)
    churn = Column(Float, nullable=False)  # 0..1
    arpu = Column(Numeric(14, 2), nullable=True)
    runway_months = Column(Float, nullable=True)
    stage = Column(String(50), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
