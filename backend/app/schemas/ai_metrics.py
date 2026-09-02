from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime

class MetricsRequest(BaseModel):
    """Метрики, которые клиент отправляет на сервер."""
    mrr: float = Field(..., gt=0, description="Monthly Recurring Revenue")
    cac: float = Field(..., gt=0, description="Customer Acquisition Cost")
    ltv: float = Field(..., gt=0, description="Customer Lifetime Value")
    churn: float = Field(..., ge=0, le=1, description="Monthly Churn Rate (0-1)")
    arpu: float = Field(..., gt=0, description="Average Revenue Per User")
    runway_months: float = Field(..., gt=0, description="Months of Runway")
    stage: str = Field(..., description="pre_seed, seed, series_a, etc")
    active_users: Optional[int] = Field(None, gt=0)
    
    @field_validator("stage")
    @classmethod
    def validate_stage(cls, v: str) -> str:
        allowed = {"pre_seed", "seed", "series_a", "series_b", "growth"}
        if v not in allowed:
            raise ValueError(f"Stage must be one of {allowed}")
        return v

class MetricsResponse(BaseModel):
    """Ответ с расчитанными метриками."""
    mrr: float
    cac: float
    ltv: float
    churn: float
    arpu: float
    runway_months: float
    ltv_cac_ratio: float
    healthy: bool
    alerts: List[str]
