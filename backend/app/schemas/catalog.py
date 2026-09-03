"""Pydantic schemas for the metric catalog endpoint.

Mirrors the return shapes of `app.core.metric_catalog`: industries and
business models are flat lists, and `profiles` is a nested
`industry -> business_model -> profile` mapping.
"""

from pydantic import BaseModel, ConfigDict


class MetricDef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    label: str
    required: bool
    why: str


class MetricProfile(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    label: str
    why: str
    metrics: list[MetricDef]
    derived: list[str]


class BusinessModelItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    label: str
    description: str


class IndustryItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    label: str


class CatalogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    industries: list[IndustryItem]
    business_models: list[BusinessModelItem]
    profiles: dict[str, dict[str, MetricProfile]]
