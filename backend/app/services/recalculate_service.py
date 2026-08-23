from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.recalculate import RecalculateResponse
from app.services.cashflow_service import CashFlowService
from app.services.credit_service import CreditService
from app.services.pnl_service import PnLService
from app.services.sensitivity_service import SensitivityService
from app.services.unit_economics_service import UnitEconomicsService
from app.services.valuation_service import ValuationService


class RecalculateService:
    """Принудительный пересчёт всех производных модулей компании (TZ v5.0, раздел 18)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def recalculate(self, company_id: UUID) -> RecalculateResponse:
        """Пересчитывает все прогнозы и возвращает сводку ключевых показателей.

        Все модули (юнит-экономика, P&L, Cash Flow, кредиты, оценка,
        чувствительность) считаются на лету из сырых данных, поэтому вызов
        сервисов и есть полный пересчёт.
        """
        unit = await UnitEconomicsService(self.db).get_unit_economics(company_id)
        pnl = await PnLService(self.db).get_pnl(company_id)
        cashflow = await CashFlowService(self.db).get_cashflow(company_id)
        credit = await CreditService(self.db).forecast(company_id)
        valuation = await ValuationService(self.db).get_valuation(company_id)
        sensitivity = await SensitivityService(self.db).analyze(company_id)

        parts = [
            p for p in (credit.summary, valuation.summary, sensitivity.summary) if p
        ]
        summary = " ".join(parts) or "Пересчёт выполнен."

        return RecalculateResponse(
            company_id=company_id,
            recalculated_at=datetime.now(timezone.utc),
            mrr=unit.mrr,
            runway_months=unit.runway_months,
            ltv_cac=unit.ltv_cac,
            ebitda=pnl.ebitda,
            net_profit=pnl.net_profit,
            total_cf=cashflow.total_cf,
            equity_value=valuation.equity_value,
            total_credit_needed=credit.total_credit_needed,
            summary=summary,
        )
