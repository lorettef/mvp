from sqlalchemy import Column, String, DateTime, Integer, ForeignKey
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    plan = Column(String(50), nullable=False, default="free")  # free, pro, business
    status = Column(String(50), nullable=False, default="active")  # active, cancelled, expired
    daily_limit = Column(Integer, nullable=False, default=1)
    start_date = Column(DateTime, server_default=func.now())
    end_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
