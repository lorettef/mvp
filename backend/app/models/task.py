from sqlalchemy import Column, String, DateTime, ForeignKey, Date
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    description = Column(String(1000), nullable=True)
    stage = Column(String(30), nullable=False)  # metrics, documents, negotiations, presentation
    status = Column(String(20), nullable=False)  # pending, in_progress, done
    due_date = Column(Date, nullable=True)
    source = Column(String(30), nullable=False, default="manual", server_default="manual")  # manual | ai_recommendation
    metric = Column(String(50), nullable=True)  # slug из METRIC_KEYS/DERIVED_KEYS или None
    priority = Column(String(10), nullable=True)  # high | medium | low
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
