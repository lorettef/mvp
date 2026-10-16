"""Company-scoped immutable Fund review corrections."""

from datetime import date, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_company_access
from app.core.database import get_db
from app.models.correction import Correction
from app.models.metric import Metric
from app.models.user import User
from app.schemas.correction import (
    CorrectionCreate,
    CorrectionResponse,
    CorrectionTargetType,
)
from app.services.correction_service import (
    decimal_snapshot,
    metric_for_target,
    require_current_unit_context,
    unit_snapshot,
    unit_value,
    validate_corrected_value,
)

router = APIRouter()


def serialize(
    correction: Correction,
    author: User,
    current_value,
    current_updated_at: datetime | None = None,
    current_context: tuple[date | None, str | None, UUID | None] | None = None,
) -> CorrectionResponse:
    current = decimal_snapshot(current_value)
    stale = current is None or current != correction.original_value
    if (
        correction.target_type == "metric_value"
        and correction.source_updated_at is not None
    ):
        # A source edit is a new snapshot even when the visible number is equal.
        stale = stale or current_updated_at != correction.source_updated_at
    if correction.target_type == "unit_economics":
        stale = stale or current_context != (
            correction.target_period,
            correction.target_scenario,
            correction.source_metric_id,
        )
    return CorrectionResponse(
        id=correction.id,
        company_id=correction.company_id,
        author_id=correction.author_id,
        author_name=author.full_name or author.email,
        target_type=correction.target_type,
        metric_id=correction.metric_id,
        field=correction.field,
        indicator_key=correction.indicator_key,
        target_period=correction.target_period,
        target_scenario=correction.target_scenario,
        source_metric_id=correction.source_metric_id,
        source_updated_at=correction.source_updated_at,
        original_value=correction.original_value,
        corrected_value=correction.corrected_value,
        current_source_value=current,
        is_stale=stale,
        reason=correction.reason,
        created_at=correction.created_at,
    )


@router.get("/{company_id}/corrections", response_model=list[CorrectionResponse])
async def list_corrections(
    company_id: UUID,
    target_type: CorrectionTargetType = Query(...),
    metric_id: UUID | None = None,
    field: str | None = None,
    indicator_key: str | None = None,
    target_period: date | None = None,
    target_scenario: str | None = None,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    if target_scenario is not None and target_scenario not in ("plan", "fact"):
        raise HTTPException(422, "Неверный сценарий")
    query = (
        select(Correction, User)
        .join(User, User.id == Correction.author_id)
        .where(
            Correction.company_id == company_id, Correction.target_type == target_type
        )
    )
    for column, value in (
        (Correction.metric_id, metric_id),
        (Correction.field, field),
        (Correction.indicator_key, indicator_key),
        (Correction.target_period, target_period),
        (Correction.target_scenario, target_scenario),
    ):
        if value is not None:
            query = query.where(column == value)
    # Company access is checked above; historical authors may change tenants.
    rows = (
        await db.execute(
            query.order_by(Correction.created_at, Correction.id).execution_options(
                skip_tenant_filter=True
            )
        )
    ).all()
    if not rows:
        return []
    metrics = {}
    unit = None
    if target_type == "metric_value":
        ids = {correction.metric_id for correction, _ in rows}
        metrics = {
            m.id: m
            for m in (
                await db.scalars(
                    select(Metric).where(
                        Metric.company_id == company_id, Metric.id.in_(ids)
                    )
                )
            ).all()
        }
    else:
        unit = await unit_snapshot(db, company_id)
    result = []
    for correction, author in rows:
        if target_type == "metric_value":
            metric = metrics.get(correction.metric_id)
            current = getattr(metric, correction.field) if metric else None
            result.append(
                serialize(
                    correction,
                    author,
                    current,
                    current_updated_at=metric.updated_at if metric else None,
                )
            )
        else:
            current = unit_value(unit, correction.indicator_key)
            source = unit.source_metric
            result.append(
                serialize(
                    correction,
                    author,
                    current,
                    current_context=(
                        source.period if source else None,
                        source.type if source else None,
                        source.id if source else None,
                    ),
                )
            )
    return result


@router.post(
    "/{company_id}/corrections",
    response_model=CorrectionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_correction(
    company_id: UUID,
    data: CorrectionCreate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    if user["product_role"] != "fund":
        raise HTTPException(403, "Недостаточно прав")
    validate_corrected_value(data)
    metric = None
    unit = None
    if data.target_type == "metric_value":
        metric = await metric_for_target(db, company_id, data.metric_id)
        original = decimal_snapshot(getattr(metric, data.field))
    else:
        unit = await unit_snapshot(db, company_id)
        require_current_unit_context(data, unit)
        original = unit_value(unit, data.indicator_key)
    if original is None:
        raise HTTPException(
            409, "У показателя нет исходного значения для корректировки"
        )
    source = unit.source_metric if unit else None
    correction = Correction(
        company_id=company_id,
        author_id=user["user_id"],
        target_type=data.target_type,
        metric_id=data.metric_id,
        field=data.field,
        indicator_key=data.indicator_key,
        target_period=data.target_period,
        target_scenario=data.target_scenario,
        source_metric_id=source.id if source else None,
        source_updated_at=metric.updated_at if metric else None,
        original_value=original,
        corrected_value=data.corrected_value,
        reason=data.reason,
    )
    db.add(correction)
    await db.flush()
    await db.refresh(correction)
    author = await db.get(User, user["user_id"])
    return serialize(
        correction,
        author,
        original,
        current_updated_at=metric.updated_at if metric else None,
        current_context=(
            data.target_period,
            data.target_scenario,
            source.id if source else None,
        ),
    )
