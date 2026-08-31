import html
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.services.unit_economics_service import UnitEconomicsService


def _money(v) -> str:
    return "—" if v is None else f"{v:,.0f} ₽"


def _pct(v) -> str:
    return "—" if v is None else f"{v * 100:.1f}%"


def _months(v) -> str:
    return "—" if v is None else f"{v:.1f} мес."


class WeeklyReportService:
    """Формирование еженедельного email-отчёта по портфелю компании."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def build_report_html(self, organization_id: UUID) -> str:
        """HTML-отчёт: ключевые метрики и алерты по каждой компании организации."""
        result = await self.db.execute(
            select(Company)
            .where(Company.organization_id == organization_id)
            .order_by(Company.name)
        )
        companies = list(result.scalars().all())

        sections = []
        for company in companies:
            unit = await UnitEconomicsService(self.db).get_unit_economics(company.id)
            alerts = "".join(f"<li>{html.escape(a)}</li>" for a in unit.alerts)
            sections.append(
                f"<h3>{html.escape(company.name)}</h3>"
                "<ul>"
                f"<li>MRR: {_money(unit.revenue)}</li>"
                f"<li>CAC: {_money(unit.cac)}</li>"
                f"<li>LTV: {_money(unit.ltv)}</li>"
                f"<li>Churn: {_pct(unit.churn)}</li>"
                f"<li>Runway: {_months(unit.runway_months)}</li>"
                "</ul>"
                f"<ul>{alerts}</ul>"
            )

        body = "".join(sections) or "<p>В портфеле пока нет компаний.</p>"

        return (
            "<html><body>"
            "<h2>Еженедельный отчёт по портфелю</h2>"
            f"{body}"
            "</body></html>"
        )
