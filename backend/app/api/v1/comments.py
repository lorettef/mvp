"""Company-scoped, immutable Fund review comments."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import require_company_access
from app.core.database import get_db
from app.models.comment import Comment
from app.models.metric import Metric
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentResponse, CommentTargetType

router = APIRouter()


def response(comment: Comment, author: User) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        company_id=comment.company_id,
        author_id=comment.author_id,
        author_name=author.full_name or author.email,
        target_type=comment.target_type,
        metric_id=comment.metric_id,
        field=comment.field,
        indicator_key=comment.indicator_key,
        target_period=comment.target_period,
        target_scenario=comment.target_scenario,
        text=comment.text,
        created_at=comment.created_at,
    )


@router.get("/{company_id}/comments", response_model=list[CommentResponse])
async def list_comments(
    company_id: UUID,
    target_type: CommentTargetType = Query(...),
    metric_id: UUID | None = None,
    field: str | None = None,
    indicator_key: str | None = None,
    target_period: str | None = None,
    target_scenario: str | None = None,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Comment, User)
        .join(User, User.id == Comment.author_id)
        .where(Comment.company_id == company_id, Comment.target_type == target_type)
    )
    if metric_id is not None:
        query = query.where(Comment.metric_id == metric_id)
    if field is not None:
        query = query.where(Comment.field == field)
    if indicator_key is not None:
        query = query.where(Comment.indicator_key == indicator_key)
    if target_period is not None:
        from datetime import date

        try:
            query = query.where(
                Comment.target_period == date.fromisoformat(target_period)
            )
        except ValueError as exc:
            raise HTTPException(422, "Неверный период") from exc
    if target_scenario is not None:
        if target_scenario not in ("plan", "fact"):
            raise HTTPException(422, "Неверный сценарий")
        query = query.where(Comment.target_scenario == target_scenario)
    # Access was checked against the company above. Historical authors may later
    # move organizations; their review history must remain readable here.
    rows = (
        await db.execute(
            query.order_by(Comment.created_at, Comment.id).execution_options(
                skip_tenant_filter=True
            )
        )
    ).all()
    return [response(comment, author) for comment, author in rows]


@router.post(
    "/{company_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    company_id: UUID,
    data: CommentCreate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    if user["product_role"] != "fund":
        raise HTTPException(403, "Недостаточно прав")
    if data.target_type == "metric_value":
        metric = await db.scalar(
            select(Metric).where(
                Metric.id == data.metric_id, Metric.company_id == company_id
            )
        )
        if metric is None:
            raise HTTPException(404, "Метрика не найдена")
    author = await db.get(User, user["user_id"])
    comment = Comment(
        company_id=company_id,
        author_id=user["user_id"],
        target_type=data.target_type,
        metric_id=data.metric_id,
        field=data.field,
        indicator_key=data.indicator_key,
        target_period=data.target_period,
        target_scenario=data.target_scenario,
        text=data.text,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return response(comment, author)
