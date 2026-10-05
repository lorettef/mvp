"""Shared operating arithmetic; callers own period and Fact/Plan selection."""

from dataclasses import dataclass
from typing import Optional

from app.schemas.hiring import DEFAULT_INSURANCE_RATE, DEFAULT_INJURY_RATE


def employer_social_rate(
    insurance: float = DEFAULT_INSURANCE_RATE,
    injury: float = DEFAULT_INJURY_RATE,
) -> float:
    """Employer expense excludes employee NDFL; preserve HiringService rounding."""
    return round(sum((insurance, injury)), 4)


@dataclass(frozen=True)
class OperatingProfit:
    social_payments: Optional[float]
    total_opex: Optional[float]
    ebitda: Optional[float]


def operating_profit(
    revenue: Optional[float],
    *,
    fot: Optional[float],
    marketing: Optional[float],
    development: Optional[float],
    gna: Optional[float],
    employer_rate: float,
) -> OperatingProfit:
    """P&L cent rounding, including its existing missing-field semantics.

    Financing, loan principal/interest and income tax are outside EBITDA.
    A missing budget must be excluded by strict Fact-only portfolio callers.
    """
    social = round(fot * employer_rate, 2) if fot is not None else None
    parts = [v for v in (fot, social, marketing, development, gna) if v is not None]
    total_opex = round(sum(parts), 2) if parts else None
    ebitda = (
        round(revenue - total_opex, 2)
        if revenue is not None and total_opex is not None
        else None
    )
    return OperatingProfit(social, total_opex, ebitda)
