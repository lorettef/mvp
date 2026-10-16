from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.comment import MetricCommentField, UnitIndicator


CorrectionTargetType = Literal["metric_value", "unit_economics"]


class CorrectionCreate(BaseModel):
    target_type: CorrectionTargetType
    metric_id: UUID | None = None
    field: MetricCommentField | None = None
    indicator_key: UnitIndicator | None = None
    target_period: date | None = None
    target_scenario: Literal["plan", "fact"] | None = None
    corrected_value: Decimal = Field(
        allow_inf_nan=False, max_digits=28, decimal_places=12
    )
    reason: str = Field(min_length=1, max_length=3000)

    @field_validator("reason")
    @classmethod
    def trim_reason(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Причина корректировки обязательна")
        return value

    @model_validator(mode="after")
    def valid_target(self):
        if self.target_type == "metric_value":
            valid = bool(self.metric_id and self.field) and not any(
                (self.indicator_key, self.target_period, self.target_scenario)
            )
        else:
            valid = (
                bool(self.indicator_key)
                and not self.metric_id
                and not self.field
                and ((self.target_period is None) == (self.target_scenario is None))
            )
        if not valid:
            raise ValueError("Некорректная цель корректировки")
        return self


class CorrectionResponse(BaseModel):
    id: UUID
    company_id: UUID
    author_id: UUID
    author_name: str
    target_type: CorrectionTargetType
    metric_id: UUID | None
    field: str | None
    indicator_key: str | None
    target_period: date | None
    target_scenario: str | None
    source_metric_id: UUID | None
    source_updated_at: datetime | None
    original_value: Decimal
    corrected_value: Decimal
    current_source_value: Decimal | None
    is_stale: bool
    reason: str
    created_at: datetime
