import json
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metric import Metric
from app.schemas.metric import MetricUpsert
from app.schemas.plan import PlanGenerateResponse, PlanMetricItem
from app.services.ai_service import AIService
from app.services.metric_service import MetricService

DEFAULT_MONTHS = 6
GROWTH = 0.05

PLAN_SYSTEM_PROMPT = (
    "Ты — финансовый аналитик SaaS-стартапов. "
    "Отвечай строго в формате JSON, без пояснений вне JSON."
)


class PlanGenerationService:
    """Генерация плана метрик (TZ v5.0, раздел 7.1 — кнопка «Сгенерировать план AI»)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def generate(
        self,
        company_id: UUID,
        user_id: UUID,
        months: int = DEFAULT_MONTHS,
    ) -> PlanGenerateResponse:
        """Генерирует план метрик на основе фактической истории и сохраняет его."""
        facts = await self._fact_history(company_id)
        if not facts:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Нет фактических метрик для генерации плана. Добавьте хотя бы один факт.",
            )

        demo_summary, demo_items = self._demo_plan(facts[0], months)
        prompt = self._build_prompt(facts, months)

        ai = AIService(self.db)
        text, provider = await ai.complete(
            prompt,
            system=PLAN_SYSTEM_PROMPT,
            demo_text=json.dumps(
                {
                    "summary": demo_summary,
                    "months": [
                        {
                            "period": it.period.strftime("%Y-%m"),
                            "new_units": it.new_units,
                            "arpu": it.arpu,
                            "revenue": it.revenue,
                            "marketing_spend": it.marketing_spend,
                            "retention_rate": it.retention_rate,
                        }
                        for it in demo_items
                    ],
                },
                ensure_ascii=False,
            ),
        )

        summary, items = self._parse(text, demo_summary, demo_items)

        metric_service = MetricService(self.db)
        for item in items:
            await metric_service.upsert_metric(
                company_id,
                MetricUpsert(
                    period=item.period,
                    type="plan",
                    new_units=item.new_units,
                    arpu=item.arpu,
                    revenue=item.revenue,
                    marketing_spend=item.marketing_spend,
                    retention_rate=item.retention_rate,
                ),
            )
        await self.db.flush()

        return PlanGenerateResponse(
            company_id=company_id,
            provider=provider,
            summary=summary,
            metrics=items,
        )

    async def _fact_history(self, company_id: UUID) -> List[Metric]:
        result = await self.db.execute(
            select(Metric)
            .where(Metric.company_id == company_id, Metric.type == "fact")
            .order_by(Metric.period.desc())
        )
        return list(result.scalars().all())

    def _build_prompt(self, facts: List[Metric], months: int) -> str:
        lines = [
            (
                f"- {f.period.isoformat()}: Выручка={float(f.revenue):,.0f}, "
                f"Новые юниты={f.new_units}, ARPU={float(f.arpu):,.0f}, "
                f"Маркетинг={float(f.marketing_spend):,.0f}, "
                f"Retention={float(f.retention_rate) * 100:.1f}%"
            )
            for f in facts
        ]
        return (
            "Ты — финансовый аналитик SaaS-стартапов.\n"
            f"Составь план (прогноз) ключевых метрик на следующие {months} месяцев "
            "на основе фактической истории компании.\n\n"
            "Фактическая история (по убыванию периода):\n"
            f"{chr(10).join(lines)}\n\n"
            "Верни ответ строго в формате JSON:\n"
            "{\n"
            '  "summary": "Краткое обоснование плана",\n'
            '  "months": [\n'
            '    {"period": "YYYY-MM", "new_units": <число>, "arpu": <число>, '
            '"revenue": <число>, "marketing_spend": <число>, '
            '"retention_rate": <доля от 0 до 1>},\n'
            "    ...\n"
            "  ]\n"
            "}\n\n"
            "Правила:\n"
            f"- Ровно {months} записей, периоды идут подряд по месяцам начиная со следующего после последнего факта.\n"
            "- Выручка растёт реалистично (5–15% в месяц), ARPU/Retention меняются плавно.\n"
            "- retention_rate — доля в диапазоне [0, 1].\n"
            "- Все числа > 0, валюта — рубли.\n"
        )

    def _demo_plan(
        self, latest: Metric, months: int
    ) -> Tuple[str, List[PlanMetricItem]]:
        """Детерминированный демо-план: выручка +5%/мес, прочие метрики постоянны."""
        revenue = float(latest.revenue)
        new_units = int(latest.new_units)
        arpu = float(latest.arpu)
        marketing_spend = float(latest.marketing_spend)
        retention_rate = float(latest.retention_rate)

        items = []
        for m in range(1, months + 1):
            items.append(
                PlanMetricItem(
                    period=self._add_months(latest.period, m),
                    new_units=new_units,
                    arpu=round(arpu, 2),
                    revenue=round(revenue * (1 + GROWTH) ** m, 2),
                    marketing_spend=round(marketing_spend, 2),
                    retention_rate=round(retention_rate, 4),
                )
            )

        summary = (
            f"Демо-план: рост выручки {GROWTH:.0%} в месяц на {months} мес. "
            "Новые юниты/ARPU/Маркетинг/Retention сохранены на уровне последнего факта."
        )
        return summary, items

    def _parse(
        self,
        text: str,
        demo_summary: str,
        demo_items: List[PlanMetricItem],
    ) -> Tuple[str, List[PlanMetricItem]]:
        """Парсит JSON от LLM; при любой ошибке возвращает демо-план."""
        try:
            start = text.find("{")
            end = text.rfind("}") + 1
            if start < 0 or end <= start:
                raise ValueError("JSON не найден")
            data = json.loads(text[start:end])

            summary = str(data.get("summary") or demo_summary)
            months = data.get("months") or []
            items: List[PlanMetricItem] = []
            for m in months:
                if not isinstance(m, dict):
                    continue
                period = self._parse_period(m.get("period"))
                new_units = self._nonneg_int(m.get("new_units"))
                arpu = self._positive(m.get("arpu"))
                revenue = self._positive(m.get("revenue"))
                marketing_spend = self._nonneg(m.get("marketing_spend"))
                retention_rate = self._fraction(m.get("retention_rate"))
                if period is None or new_units is None or arpu is None or revenue is None:
                    continue
                items.append(
                    PlanMetricItem(
                        period=period,
                        new_units=new_units,
                        arpu=round(arpu, 2),
                        revenue=round(revenue, 2),
                        marketing_spend=round(marketing_spend, 2),
                        retention_rate=round(retention_rate, 4),
                    )
                )
            if not items:
                return demo_summary, demo_items
            return summary, items
        except Exception:
            return demo_summary, demo_items

    @staticmethod
    def _positive(value) -> Optional[float]:
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None
        return num if num > 0 else None

    @staticmethod
    def _nonneg(value) -> Optional[float]:
        try:
            num = float(value)
        except (TypeError, ValueError):
            return None
        return num if num >= 0 else None

    @staticmethod
    def _nonneg_int(value) -> Optional[int]:
        try:
            num = int(float(value))
        except (TypeError, ValueError):
            return None
        return num if num >= 0 else None

    @staticmethod
    def _fraction(value) -> float:
        try:
            num = float(value)
        except (TypeError, ValueError):
            return 0.0
        return min(max(num, 0.0), 1.0)

    @staticmethod
    def _parse_period(value) -> Optional[date]:
        if value is None:
            return None
        if isinstance(value, date):
            return date(value.year, value.month, 1)
        s = str(value).strip()
        try:
            if len(s) == 7:  # YYYY-MM
                year, month = s.split("-")
                return date(int(year), int(month), 1)
            d = date.fromisoformat(s[:10])
            return date(d.year, d.month, 1)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _add_months(d: date, offset: int) -> date:
        zero = d.month - 1 + offset
        year = d.year + zero // 12
        month = zero % 12 + 1
        return date(year, month, 1)
