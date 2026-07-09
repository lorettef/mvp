from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Index
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid

class AICache(Base):
    __tablename__ = "ai_cache"
    __table_args__ = (
        Index("ix_ai_cache_user_created", "user_id", "created_at"),
    )
    
    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    metrics_hash = Column(String(64), nullable=False, index=True)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False)
