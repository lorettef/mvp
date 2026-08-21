from sqlalchemy import Column, DateTime, Float, ForeignKey
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class HiringSettings(Base):
    """Настройки соц. платежей компании (НДФЛ, страховые взносы, травматизм)."""

    __tablename__ = "hiring_settings"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(
        Uuid(as_uuid=True),
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        unique=True,
    )
    ndfl_rate = Column(Float, nullable=False, default=0.13)
    insurance_rate = Column(Float, nullable=False, default=0.30)
    injury_rate = Column(Float, nullable=False, default=0.002)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
