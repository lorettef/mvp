import json
from typing import Any, List, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.insight import InsightResponse, InsightScenario
from app.services.ai_service import AIService
from app.services.budget_service import BudgetService
from app.services.cashflow_service import CashFlowService
from app.services.cohort_service import CohortService
from app.services.credit_service import CreditService
from app.services.hiring_service import HiringService
from app.services.pnl_service import PnLService
from app.services.sensitivity_service import SensitivityService
from app.services.task_service import TaskService
from app.services.unit_economics_service import UnitEconomicsService
from app.services.valuation_service import ValuationService

INSIGHT_SYSTEM_PROMPT = (
    "Ты — финансовый аналитик акселератора SaaS-стартапов. "
    "Отвечай кратко и по делу, по-русски, обычным текстом."
)

SCENARIO_LABELS = {
    "unit_economics": "юнит-экономика",
    "cohorts": "когорты и удержание",
    "budget": "бюджет",
    "readiness": "готовность к продаже",
    "hiring": "прогноз найма",
    "pnl": "P&L",
    "cashflow": "Cash Flow",
    "credit": "кредиты",
    "valuation": "оценка бизнеса",
    "sensitivity": "чувствительность",
    "reports": "сводка для инвесторов",
}


class InsightService:
    """AI-нарратив поверх детерминированных расчётов модулей (TZ v5.0, раздел 2.3)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def narrate(
        self,
        company_id: UUID,
        scenario: InsightScenario,
        user_id: UUID,
    ) -> InsightResponse:
        label, data_text, demo_text = await self._gather(company_id, scenario)
        prompt = self._build_prompt(label, data_text)

        ai = AIService(self.db)
        text, provider = await ai.complete(
            prompt,
            system=INSIGHT_SYSTEM_PROMPT,
            demo_text=demo_text,
        )

        return InsightResponse(
            company_id=company_id,
            scenario=scenario.value,
            provider=provider,
            text=text,
        )

    async def _gather(
        self, company_id: UUID, scenario: InsightScenario
    ) -> Tuple[str, str, str]:
        label = SCENARIO_LABELS[scenario.value]

        if scenario == InsightScenario.unit_economics:
            resp = await UnitEconomicsService(self.db).get_unit_economics(company_id)
        elif scenario == InsightScenario.cohorts:
            resp = await CohortService(self.db).list_cohorts(company_id)
        elif scenario == InsightScenario.budget:
            resp = await BudgetService(self.db).list_budgets(company_id)
        elif scenario == InsightScenario.readiness:
            resp = await TaskService(self.db).get_readiness(company_id)
        elif scenario == InsightScenario.hiring:
            resp = await HiringService(self.db).generate_plan(company_id)
        elif scenario == InsightScenario.pnl:
            resp = await PnLService(self.db).get_pnl(company_id)
        elif scenario == InsightScenario.cashflow:
            resp = await CashFlowService(self.db).get_cashflow(company_id)
        elif scenario == InsightScenario.credit:
            resp = await CreditService(self.db).forecast(company_id)
        elif scenario == InsightScenario.valuation:
            resp = await ValuationService(self.db).get_valuation(company_id)
        elif scenario == InsightScenario.sensitivity:
            resp = await SensitivityService(self.db).analyze(company_id)
        elif scenario == InsightScenario.reports:
            resp = await self._reports_data(company_id)
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Неизвестный сценарий",
            )

        data_text = self._serialize(resp)
        demo_text = self._demo_text(resp)
        return label, data_text, demo_text

    async def _reports_data(self, company_id: UUID) -> dict:
        unit = await UnitEconomicsService(self.db).get_unit_economics(company_id)
        pnl = await PnLService(self.db).get_pnl(company_id)
        cashflow = await CashFlowService(self.db).get_cashflow(company_id)
        valuation = await ValuationService(self.db).get_valuation(company_id)
        return {
            "mrr": unit.mrr,
            "cac": unit.cac,
            "ltv": unit.ltv,
            "churn": unit.churn,
            "runway_months": unit.runway_months,
            "ltv_cac": unit.ltv_cac,
            "ebitda": pnl.ebitda,
            "net_profit": pnl.net_profit,
            "total_cf": cashflow.total_cf,
            "equity_value": valuation.equity_value,
        }

    @staticmethod
    def _build_prompt(label: str, data_text: str) -> str:
        return (
            f"Проанализируй данные модуля «{label}» компании.\n\n"
            f"Данные (JSON):\n{data_text}\n\n"
            "Дай краткий аналитический вывод (3–5 предложений): "
            "что в норме, что требует внимания, ключевые риски, "
            "и 2–3 конкретные рекомендации. Пиши по-русски, обычным текстом."
        )

    @staticmethod
    def _serialize(obj: Any) -> str:
        def conv(o: Any) -> Any:
            return o.model_dump() if hasattr(o, "model_dump") else o

        if hasattr(obj, "model_dump"):
            obj = obj.model_dump()
        if isinstance(obj, list):
            obj = [conv(o) for o in obj]
        return json.dumps(obj, ensure_ascii=False, default=str)

    @staticmethod
    def _demo_text(resp: Any) -> str:
        parts: List[str] = []

        if hasattr(resp, "model_dump"):
            resp = resp.model_dump()

        if isinstance(resp, dict):
            if resp.get("summary"):
                parts.append(str(resp["summary"]))
            for key in ("alerts", "risks", "conclusions"):
                value = resp.get(key)
                if isinstance(value, list):
                    parts.extend(str(x) for x in value if x)
        elif isinstance(resp, list):
            if resp:
                parts.append(f"Данные по {len(resp)} периодам.")

        return "\n".join(parts) if parts else "Недостаточно данных для вывода."
