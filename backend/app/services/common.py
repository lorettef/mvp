from dataclasses import dataclass
from datetime import date
from enum import StrEnum
from typing import List, Literal, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.budget import Budget
from app.models.financing import Financing
from app.models.metric import Metric


class PlanFact(StrEnum):
    PLAN = "plan"
    FACT = "fact"


async def latest_metrics(
    db: AsyncSession,
    company_id,
    *,
    prefer: Literal["fact", "plan"] = "fact",
    fallback: bool = False,
    limit: int = 1,
) -> List[Metric]:
    """Latest metrics by period desc (up to `limit` rows) of the preferred type.

    fallback=True: if no rows of `prefer`, return the OTHER type's latest rows.
    """
    rows = await db.execute(
        select(Metric)
        .where(Metric.company_id == company_id, Metric.type == prefer)
        .order_by(Metric.period.desc())
        .limit(limit)
    )
    result = list(rows.scalars().all())
    if fallback and not result:
        other = PlanFact.PLAN.value if prefer == PlanFact.FACT.value else PlanFact.FACT.value
        rows = await db.execute(
            select(Metric)
            .where(Metric.company_id == company_id, Metric.type == other)
            .order_by(Metric.period.desc())
            .limit(limit)
        )
        result = list(rows.scalars().all())
    return result


async def latest_budget(
    db: AsyncSession, company_id, *, limit: int = 1
) -> Optional[Budget]:
    """Latest Budget (fact preferred, else plan), or None if none exists."""
    for type_ in (PlanFact.FACT.value, PlanFact.PLAN.value):
        result = await db.execute(
            select(Budget)
            .where(Budget.company_id == company_id, Budget.type == type_)
            .order_by(Budget.period.desc())
            .limit(limit)
        )
        row = result.scalars().first()
        if row is not None:
            return row
    return None


def f(value, default: float = 0.0) -> float:
    """float(value) with a default when value is None."""
    return float(value) if value is not None else default


def div(a, b, default: float = 0.0, round_to: int = 4):
    """Safe division; returns `default` on None args or zero denominator."""
    if a is None or b is None or b == 0:
        return default
    return round(a / b, round_to)


@dataclass
class FinancingSums:
    debt: float
    cash: float
    total: float


async def financing_sums(db: AsyncSession, company_id) -> FinancingSums:
    """Aggregate financing: debt=sum(credit), cash=sum(investment), total=debt+cash.

    NOTE: the plan referenced a `period` arg, but Financing has NO period column
    (verified models/financing.py) — the legacy queries also don't filter by period.
    Documented deviation: signature omits `period`.
    """
    result = await db.execute(
        select(Financing.type, func.sum(Financing.amount))
        .where(Financing.company_id == company_id)
        .group_by(Financing.type)
    )
    debt = 0.0
    cash = 0.0
    for type_, total in result.all():
        if total is None:
            continue
        if type_ == "credit":
            debt += float(total)
        else:
            cash += float(total)
    debt = round(debt, 2)
    cash = round(cash, 2)
    return FinancingSums(debt=debt, cash=cash, total=round(debt + cash, 2))


def period_for_month(m: int) -> date:
    """First day of the month m months from now (m=1 → next month)."""
    today = date.today()
    zero_month = today.month - 1 + m
    year = today.year + zero_month // 12
    month = zero_month % 12 + 1
    return date(year, month, 1)
