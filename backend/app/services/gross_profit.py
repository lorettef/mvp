"""Canonical gross arithmetic. Callers select matching company/period/scenario."""

from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class GrossProfit:
    gross_profit: Optional[float]
    gross_margin: Optional[float]


def gross_profit(revenue: Optional[float], cogs: Optional[float]) -> GrossProfit:
    if revenue is None or cogs is None:
        return GrossProfit(None, None)
    profit = round(revenue - cogs, 2)
    # Do not round the ratio before downstream Payback; zero COGS is real.
    margin = (revenue - cogs) / revenue if revenue > 0 else None
    return GrossProfit(profit, margin)
