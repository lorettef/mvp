from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


CommentTargetType = Literal["overview", "metric_value", "unit_economics"]
MetricCommentField = Literal[
    "new_units", "arpu", "revenue", "marketing_spend", "retention_rate"
]
UnitIndicator = Literal[
    "gross_margin",
    "ltv_cac",
    "magic_number",
    "runway_months",
    "payback_period",
    "romi",
    "churn",
    "revenue",
    "cac",
    "ltv",
    "retention_m1",
    "retention_m3",
    "retention_m6",
    "retention_m12",
]


class CommentCreate(BaseModel):
    target_type: CommentTargetType
    metric_id: UUID | None = None
    field: MetricCommentField | None = None
    indicator_key: UnitIndicator | None = None
    target_period: date | None = None
    target_scenario: Literal["plan", "fact"] | None = None
    text: str = Field(min_length=1, max_length=3000)

    @field_validator("text")
    @classmethod
    def trim_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Комментарий не может быть пустым")
        return value

    @model_validator(mode="after")
    def valid_target(self):
        if self.target_type == "overview":
            valid = not any(
                (
                    self.metric_id,
                    self.field,
                    self.indicator_key,
                    self.target_period,
                    self.target_scenario,
                )
            )
        elif self.target_type == "metric_value":
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
            raise ValueError("Некорректная цель комментария")
        return self


class CommentResponse(BaseModel):
    id: UUID
    company_id: UUID
    author_id: UUID
    author_name: str
    target_type: CommentTargetType
    metric_id: UUID | None
    field: str | None
    indicator_key: str | None
    target_period: date | None
    target_scenario: str | None
    text: str
    created_at: datetime
