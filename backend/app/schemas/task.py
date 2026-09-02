from datetime import date, datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, computed_field

STAGES = ["metrics", "documents", "negotiations", "presentation"]

STAGE_LABELS = {
    "metrics": "Подготовка метрик",
    "documents": "Сбор документов",
    "negotiations": "Переговоры",
    "presentation": "Презентация",
}

STATUSES = ["pending", "in_progress", "done"]

STATUS_LABELS = {
    "pending": "В ожидании",
    "in_progress": "В работе",
    "done": "Выполнено",
    "overdue": "Просрочено",
}


def _validate_stage(v: Optional[str]) -> Optional[str]:
    if v is not None and v not in STAGES:
        raise ValueError(f"stage должен быть одним из: {', '.join(STAGES)}")
    return v


def _validate_status(v: Optional[str]) -> Optional[str]:
    if v is not None and v not in STATUSES:
        raise ValueError(f"status должен быть одним из: {', '.join(STATUSES)}")
    return v


class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    stage: str = "metrics"
    status: str = "pending"
    due_date: Optional[date] = None

    _validate_stage = field_validator("stage")(_validate_stage)
    _validate_status = field_validator("status")(_validate_status)


class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    stage: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None

    _validate_stage = field_validator("stage")(_validate_stage)
    _validate_status = field_validator("status")(_validate_status)


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    company_id: UUID
    title: str
    description: Optional[str]
    stage: str
    status: str
    due_date: Optional[date]
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def effective_status(self) -> str:
        today = date.today()
        if self.status != "done" and self.due_date is not None and self.due_date < today:
            return "overdue"
        return self.status


class StageProgress(BaseModel):
    stage: str
    label: str
    total: int
    done: int
    percent: int


class ReadinessResponse(BaseModel):
    company_id: UUID
    readiness: int  # 0..100
    total_tasks: int
    done_tasks: int
    stages: List[StageProgress]
    risks: List[str]  # названия незавершённых этапов
    summary: str
