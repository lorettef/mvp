from sqlalchemy import Column, String, DateTime
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Organization(Base):
    __tablename__ = "organizations"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    organization_type = Column(String(20), nullable=False, server_default="fund")  # "fund" | "startup"
    created_at = Column(DateTime, server_default=func.now())
