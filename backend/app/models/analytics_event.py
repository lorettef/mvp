from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    event = Column(String(100), nullable=False, index=True)
    properties = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
