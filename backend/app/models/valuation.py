from sqlalchemy import Column, DateTime, Float, ForeignKey, Numeric
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Valuation(Base):
    __tablename__ = "valuations"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    fcf = Column(Numeric(14, 2), nullable=False)
    discount_rate = Column(Float, nullable=False)
    growth_rate = Column(Float, nullable=False)
    equity_value = Column(Numeric(14, 2), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
