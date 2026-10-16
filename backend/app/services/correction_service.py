"""Read-only canonical snapshots for immutable Fund review overlays."""

from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.metric import Metric
from app.schemas.correction import CorrectionCreate
from app.schemas.unit_economics import UnitEconomicsResponse
from app.services.unit_economics_service import UnitEconomicsService

PRECISION = Decimal("0.000000000001")
UNIT_FIELDS = {
    "gross_margin": "gross_margin",
    "ltv_cac": "ltv_cac",
    "magic_number": "magic_number",
    "runway_months": "runway_months",
    "payback_period": "payback_period",
    "romi": "romi",
    "churn": "churn",
    "revenue": "revenue",
    "cac": "cac",
    "ltv": "ltv",
}
RETENTION_FIELDS = {
    "retention_m1": "m1",
    "retention_m3": "m3",
    "retention_m6": "m6",
    "retention_m12": "m12",
}
RATE_FIELDS = {"retention_rate", "churn", *RETENTION_FIELDS}
NONNEGATIVE_FIELDS = {
    "new_units",
    "revenue",
    "marketing_spend",
    "cac",
    "ltv",
    "ltv_cac",
    "runway_months",
    "payback_period",
}


def decimal_snapshot(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value)).quantize(PRECISION)


def unit_value(data: UnitEconomicsResponse, key: str) -> Decimal | None:
    if key in RETENTION_FIELDS:
        value = getattr(data.retention, RETENTION_FIELDS[key])
    else:
        value = getattr(data, UNIT_FIELDS[key])
    return decimal_snapshot(value)


def validate_corrected_value(data: CorrectionCreate) -> None:
    key = data.field if data.target_type == "metric_value" else data.indicator_key
    value = data.corrected_value
    if key in RATE_FIELDS and not (0 <= value <= 1):
        raise HTTPException(422, "Доля должна быть от 0 до 1")
    if key in NONNEGATIVE_FIELDS and value < 0:
        raise HTTPException(422, "Значение не может быть отрицательным")
    if key == "new_units" and value != value.to_integral_value():
        raise HTTPException(422, "Количество должно быть целым")
    if key == "arpu" and value <= 0:
        raise HTTPException(422, "ARPU должен быть положительным")


async def metric_for_target(
    db: AsyncSession, company_id: UUID, metric_id: UUID
) -> Metric:
    metric = await db.scalar(
        select(Metric).where(Metric.id == metric_id, Metric.company_id == company_id)
    )
    if metric is None:
        raise HTTPException(404, "Метрика не найдена")
    return metric


async def unit_snapshot(db: AsyncSession, company_id: UUID) -> UnitEconomicsResponse:
    return await UnitEconomicsService(db).get_unit_economics(company_id)


def require_current_unit_context(
    data: CorrectionCreate, unit: UnitEconomicsResponse
) -> None:
    source = unit.source_metric
    period = source.period if source else None
    scenario = source.type if source else None
    if data.target_period != period or data.target_scenario != scenario:
        raise HTTPException(409, "Источник показателя изменился. Обновите страницу")
