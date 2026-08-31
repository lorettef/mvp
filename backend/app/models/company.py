from sqlalchemy import Column, String, DateTime, Float, ForeignKey, UniqueConstraint
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_company_org_name"),
    )
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    industry = Column(String(100), nullable=True)
    geography = Column(String(100), nullable=True)
    gross_margin = Column(Float, nullable=False, default=0.75)
    created_at = Column(DateTime, server_default=func.now())
