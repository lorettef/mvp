from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Numeric
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Financing(Base):
    __tablename__ = "financing"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # credit, investment
    amount = Column(Numeric(14, 2), nullable=False)
    rate = Column(Float, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
