from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint, Numeric, Date
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("company_id", "period", "type", name="uq_budget_company_period_type"),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    period = Column(Date, nullable=False)
    type = Column(String(20), nullable=False)
    marketing = Column(Numeric(14, 2), nullable=False)
    development = Column(Numeric(14, 2), nullable=False)
    fot = Column(Numeric(14, 2), nullable=False)
    gna = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
