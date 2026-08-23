import io
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.models.company import Company
from app.services.cashflow_service import CashFlowService
from app.services.pnl_service import PnLService
from app.services.unit_economics_service import UnitEconomicsService
from app.services.valuation_service import ValuationService

DEJAVU = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
DEJAVU_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

_FONT = "Helvetica"
_FONT_BOLD = "Helvetica-Bold"
try:
    pdfmetrics.registerFont(TTFont("DejaVu", DEJAVU))
    pdfmetrics.registerFont(TTFont("DejaVu-Bold", DEJAVU_BOLD))
    _FONT = "DejaVu"
    _FONT_BOLD = "DejaVu-Bold"
except Exception:
    pass


def _money(v: Optional[float]) -> str:
    return "—" if v is None else f"{v:,.0f} ₽"


def _pct(v: Optional[float]) -> str:
    return "—" if v is None else f"{v * 100:.1f}%"


def _num(v: Optional[float], digits: int = 2) -> str:
    return "—" if v is None else f"{v:.{digits}f}"


class ReportService:
    """Генерация отчётов для инвесторов (PDF + Excel)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _gather(self, company_id: UUID) -> dict:
        company = await self.db.get(Company, company_id)
        if not company:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Компания не найдена",
            )
        unit = await UnitEconomicsService(self.db).get_unit_economics(company_id)
        pnl = await PnLService(self.db).get_pnl(company_id)
        cashflow = await CashFlowService(self.db).get_cashflow(company_id)
        valuation = await ValuationService(self.db).get_valuation(company_id)
        return {
            "company": company,
            "unit": unit,
            "pnl": pnl,
            "cashflow": cashflow,
            "valuation": valuation,
        }

    def _conclusions(self, unit, valuation) -> List[str]:
        lines = [a for a in unit.alerts]
        lines.append(valuation.summary)
        return [line for line in lines if line]

    async def build_pdf(self, company_id: UUID) -> bytes:
        data = await self._gather(company_id)
        company = data["company"]
        unit = data["unit"]
        pnl = data["pnl"]
        cashflow = data["cashflow"]
        valuation = data["valuation"]

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            leftMargin=18 * mm,
            rightMargin=18 * mm,
            topMargin=18 * mm,
            bottomMargin=18 * mm,
            title="Отчёт для инвесторов",
        )

        h1 = ParagraphStyle("h1", fontName=_FONT_BOLD, fontSize=18, leading=24, spaceAfter=6)
        h2 = ParagraphStyle("h2", fontName=_FONT_BOLD, fontSize=13, leading=18, spaceBefore=14, spaceAfter=6)
        body = ParagraphStyle("body", fontName=_FONT, fontSize=10, leading=14)
        muted = ParagraphStyle("muted", fontName=_FONT, fontSize=9, leading=12, textColor=colors.grey)

        elements: list = []
        elements.append(Paragraph("Отчёт для инвесторов", h1))
        elements.append(Paragraph(f"Компания: {company.name}", body))
        elements.append(Paragraph(f"Отрасль: {company.industry or '—'} · География: {company.geography or '—'}", body))
        elements.append(Paragraph(f"Дата формирования: {date.today().isoformat()}", muted))
        elements.append(Spacer(1, 6 * mm))

        elements.append(Paragraph("Сводка", h2))
        summary_rows = [
            ["MRR", _money(unit.mrr)],
            ["CAC", _money(unit.cac)],
            ["LTV", _money(unit.ltv)],
            ["Churn", _pct(unit.churn)],
            ["Runway", f"{_num(unit.runway_months, 1)} мес."],
        ]
        elements.append(self._table(summary_rows))
        elements.append(Spacer(1, 4 * mm))

        elements.append(Paragraph("Юнит-экономика", h2))
        ue_rows = [
            ["LTV/CAC", _num(unit.ltv_cac)],
            ["Magic Number", _num(unit.magic_number)],
            ["Удержание M1", _pct(unit.retention.m1)],
            ["Удержание M3", _pct(unit.retention.m3)],
            ["Удержание M6", _pct(unit.retention.m6)],
            ["Удержание M12", _pct(unit.retention.m12)],
        ]
        elements.append(self._table(ue_rows))
        elements.append(Spacer(1, 4 * mm))

        elements.append(Paragraph("P&L", h2))
        pnl_rows = [
            ["Выручка", _money(pnl.revenue)],
            ["ФОТ", _money(pnl.fot)],
            ["Соц. платежи", _money(pnl.social_payments)],
            ["Маркетинг", _money(pnl.marketing)],
            ["Разработка", _money(pnl.development)],
            ["G&A", _money(pnl.gna)],
            ["Итого OPEX", _money(pnl.total_opex)],
            ["EBITDA", _money(pnl.ebitda)],
            ["Финансовые расходы", _money(pnl.financial_expenses)],
            ["Чистая прибыль", _money(pnl.net_profit)],
        ]
        elements.append(self._table(pnl_rows))
        elements.append(Spacer(1, 4 * mm))

        elements.append(Paragraph("Cash Flow", h2))
        cf_rows = [
            ["Операционный CF", _money(cashflow.operating_cf)],
            ["Инвестиционный CF", _money(cashflow.investing_cf)],
            ["Финансовый CF", _money(cashflow.financing_cf)],
            ["Итого CF", _money(cashflow.total_cf)],
            ["Остаток на конец", _money(cashflow.closing_balance)],
        ]
        elements.append(self._table(cf_rows))
        elements.append(Spacer(1, 4 * mm))

        elements.append(Paragraph("Оценка Гордона", h2))
        val_rows = [
            ["Equity Value", _money(valuation.equity_value)],
            ["Terminal Value", _money(valuation.terminal_value)],
            ["P/S", _num(valuation.ps_ratio)],
            ["На сотрудника", _money(valuation.value_per_employee)],
        ]
        elements.append(self._table(val_rows))
        elements.append(Spacer(1, 4 * mm))

        elements.append(Paragraph("Выводы", h2))
        for line in self._conclusions(unit, valuation):
            elements.append(Paragraph(f"• {line}", body))

        doc.build(elements)
        return buffer.getvalue()

    def _table(self, rows: List[List[str]]) -> Table:
        table = Table(rows, colWidths=[70 * mm, 80 * mm])
        table.setStyle(
            TableStyle(
                [
                    ("FONTNAME", (0, 0), (-1, -1), _FONT),
                    ("FONTSIZE", (0, 0), (-1, -1), 10),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("BACKGROUND", (0, 0), (0, -1), colors.whitesmoke),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        return table

    async def build_excel(self, company_id: UUID) -> bytes:
        data = await self._gather(company_id)
        company = data["company"]
        unit = data["unit"]
        pnl = data["pnl"]
        cashflow = data["cashflow"]
        valuation = data["valuation"]

        wb = Workbook()
        ws = wb.active
        ws.title = "Сводка"
        ws.append(["Показатель", "Значение"])
        for row in [
            ["Компания", company.name],
            ["Отрасль", company.industry or "—"],
            ["География", company.geography or "—"],
            ["MRR", unit.mrr],
            ["CAC", unit.cac],
            ["LTV", unit.ltv],
            ["Churn", unit.churn],
            ["Runway (мес.)", unit.runway_months],
            ["Equity Value", valuation.equity_value],
            ["Чистая прибыль", pnl.net_profit],
        ]:
            ws.append(row)

        self._sheet(wb, "Юнит-экономика", [
            ["LTV/CAC", unit.ltv_cac],
            ["Magic Number", unit.magic_number],
            ["M1", unit.retention.m1],
            ["M3", unit.retention.m3],
            ["M6", unit.retention.m6],
            ["M12", unit.retention.m12],
        ])

        self._sheet(wb, "P&L", [
            ["Выручка", pnl.revenue],
            ["ФОТ", pnl.fot],
            ["Соц. платежи", pnl.social_payments],
            ["Маркетинг", pnl.marketing],
            ["Разработка", pnl.development],
            ["G&A", pnl.gna],
            ["Итого OPEX", pnl.total_opex],
            ["EBITDA", pnl.ebitda],
            ["Финансовые расходы", pnl.financial_expenses],
            ["Чистая прибыль", pnl.net_profit],
        ])

        self._sheet(wb, "Cash Flow", [
            ["Операционный CF", cashflow.operating_cf],
            ["Инвестиционный CF", cashflow.investing_cf],
            ["Финансовый CF", cashflow.financing_cf],
            ["Итого CF", cashflow.total_cf],
            ["Остаток на конец", cashflow.closing_balance],
        ])

        self._sheet(wb, "Оценка", [
            ["Equity Value", valuation.equity_value],
            ["Terminal Value", valuation.terminal_value],
            ["P/S", valuation.ps_ratio],
            ["На сотрудника", valuation.value_per_employee],
        ])

        buffer = io.BytesIO()
        wb.save(buffer)
        return buffer.getvalue()

    def _sheet(self, wb: Workbook, title: str, rows: List[Tuple[str, Optional[float]]]) -> None:
        ws = wb.create_sheet(title)
        ws.append(["Показатель", "Значение"])
        for label, value in rows:
            ws.append([label, value])
