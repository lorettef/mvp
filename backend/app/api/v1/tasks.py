import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.dependencies import require_company_access, ROLE_ADMIN, ROLE_COMPANY
from app.schemas.task import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    ReadinessResponse,
)
from app.services.task_service import TaskService

router = APIRouter()


@router.get("/{company_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Список задач подготовки к продаже компании."""
    service = TaskService(db)
    tasks = await service.list_tasks(company_id)
    return [TaskResponse.model_validate(t) for t in tasks]


@router.post(
    "/{company_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_task(
    company_id: uuid.UUID,
    data: TaskCreate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Создание задачи (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    service = TaskService(db)
    task = await service.create_task(company_id, data)
    return TaskResponse.model_validate(task)


@router.patch("/{company_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    company_id: uuid.UUID,
    task_id: uuid.UUID,
    data: TaskUpdate,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Обновление задачи (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    service = TaskService(db)
    task = await service.get_task(task_id)
    if task.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена",
        )
    task = await service.update_task(task, data)
    return TaskResponse.model_validate(task)


@router.delete("/{company_id}/tasks/{task_id}")
async def delete_task(
    company_id: uuid.UUID,
    task_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Удаление задачи (admin или company)."""
    if user["role"] not in (ROLE_ADMIN, ROLE_COMPANY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недостаточно прав",
        )
    service = TaskService(db)
    task = await service.get_task(task_id)
    if task.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Задача не найдена",
        )
    await service.delete_task(task)
    return {"detail": "ok"}


@router.get("/{company_id}/readiness", response_model=ReadinessResponse)
async def get_readiness(
    company_id: uuid.UUID,
    user: dict = Depends(require_company_access()),
    db: AsyncSession = Depends(get_db),
):
    """Готовность компании к продаже (процент + этапы + риски)."""
    service = TaskService(db)
    return await service.get_readiness(company_id)
