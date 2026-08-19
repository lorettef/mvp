from typing import List
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    ReadinessResponse,
    StageProgress,
    STAGES,
    STAGE_LABELS,
)


class TaskService:
    """Управление задачами подготовки к продаже (главное УТП)."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_tasks(self, company_id: UUID) -> List[Task]:
        result = await self.db.execute(
            select(Task)
            .where(Task.company_id == company_id)
            .order_by(Task.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_task(self, company_id: UUID, data: TaskCreate) -> Task:
        task = Task(
            company_id=company_id,
            title=data.title,
            description=data.description,
            stage=data.stage,
            status=data.status,
            due_date=data.due_date,
        )
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def get_task(self, task_id: UUID) -> Task:
        task = await self.db.get(Task, task_id)
        if not task:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Задача не найдена",
            )
        return task

    async def update_task(self, task: Task, data: TaskUpdate) -> Task:
        for field in ("title", "description", "stage", "status", "due_date"):
            value = getattr(data, field)
            if value is not None:
                setattr(task, field, value)
        await self.db.flush()
        await self.db.refresh(task)
        return task

    async def delete_task(self, task: Task) -> None:
        await self.db.delete(task)
        await self.db.flush()

    async def get_readiness(self, company_id: UUID) -> ReadinessResponse:
        """Процент готовности к продаже по задачам (по этапам)."""
        tasks = await self.list_tasks(company_id)
        total = len(tasks)
        done = sum(1 for t in tasks if t.status == "done")
        readiness = round(done / total * 100) if total > 0 else 0

        stages: List[StageProgress] = []
        risks: List[str] = []
        for stage in STAGES:
            stage_tasks = [t for t in tasks if t.stage == stage]
            stage_total = len(stage_tasks)
            stage_done = sum(1 for t in stage_tasks if t.status == "done")
            stage_percent = round(stage_done / stage_total * 100) if stage_total > 0 else 0
            stages.append(
                StageProgress(
                    stage=stage,
                    label=STAGE_LABELS[stage],
                    total=stage_total,
                    done=stage_done,
                    percent=stage_percent,
                )
            )
            if stage_total > 0 and stage_done < stage_total:
                risks.append(STAGE_LABELS[stage])

        if total == 0:
            summary = "Задачи ещё не добавлены. Готовность 0%."
        elif readiness == 100:
            summary = "Готовность 100%. Все этапы завершены — компания готова к продаже."
        else:
            summary = (
                f"Готовность {readiness}%. Основные риски: "
                f"не завершены этапы {', '.join(risks)}."
            )

        return ReadinessResponse(
            company_id=company_id,
            readiness=readiness,
            total_tasks=total,
            done_tasks=done,
            stages=stages,
            risks=risks,
            summary=summary,
        )
