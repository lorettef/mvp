from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Numeric, Date, Integer, Text
from sqlalchemy import Uuid
from sqlalchemy.sql import func
from app.core.database import Base
import uuid


class Financing(Base):
    """Финансирование компании: инвестиции и кредиты/займы.

    type ∈ {"investment", "loan"}.
    investment: investor_type ∈ {"founder", "fund"}, counterparty_name — имя инвестора.
    loan: counterparty_name — кредитор; annual_rate — ГОДОВАЯ ставка в процентах
    (напр. 15.0), term_months, repayment_type, first_payment_date, issued_date —
    дата выдачи (до неё проценты не начисляются).
    """

    __tablename__ = "financing"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(Uuid(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String(20), nullable=False)  # investment | loan
    investor_type = Column(String(20), nullable=True)  # founder | fund
    counterparty_name = Column(String(255), nullable=True)
    amount = Column(Numeric(14, 2), nullable=False)
    currency = Column(String(3), nullable=False, server_default="RUB")
    issued_date = Column(Date, nullable=True)
    annual_rate = Column(Float, nullable=True)  # % годовых (loan)
    term_months = Column(Integer, nullable=True)
    repayment_type = Column(String(20), nullable=True)  # annuity
    first_payment_date = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
