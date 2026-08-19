from typing import List, Literal

from pydantic import BaseModel, Field

Industry = Literal["saas", "fintech", "ecommerce", "edtech", "healthtech", "ai", "other"]
Geography = Literal["RU", "KZ", "global"]


class MarketAnalysisRequest(BaseModel):
    industry: Industry = "saas"
    geography: Geography = "RU"
    horizon: int = Field(3, ge=1, le=3)


class MacroIndicators(BaseModel):
    gdp_growth: float  # % годовых
    inflation: float  # %
    key_rate: float  # %


class MarketImpact(BaseModel):
    mrr_factor: float  # множитель роста MRR
    cac_factor: float  # множитель CAC
    churn_factor: float  # множитель Churn


class MarketAnalysisResponse(BaseModel):
    industry: str
    industry_label: str
    geography: str
    geography_label: str
    horizon: int
    macro: MacroIndicators
    market_size: float  # ₽ млрд (текущая оценка)
    market_size_projected: float  # ₽ млрд (через horizon лет)
    market_growth: float  # % годовых
    trends: List[str]
    impact: MarketImpact
    summary: str
