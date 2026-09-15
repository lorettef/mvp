from sqlalchemy import Column, String, DateTime, Integer, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class HiringTeam(Base):
    """Текущая команда компании по ролям (workforce planning, не HRM)."""

    __tablename__ = "hiring_team"
    __table_args__ = (
        UniqueConstraint("company_id", "role_key", name="uq_hiring_team_company_role"),
    )

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    role_key = Column(String(50), nullable=False)
    headcount = Column(Integer, nullable=False, default=0)
    salary = Column(Numeric(14, 2), nullable=False, default=150000.0)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
