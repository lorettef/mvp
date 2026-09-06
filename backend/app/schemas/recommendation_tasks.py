from typing import List

from pydantic import BaseModel

from app.schemas.task import TaskResponse


class RecommendationTasksResponse(BaseModel):
    summary: str
    provider: str
    tasks: List[TaskResponse]
    created_count: int
    updated_count: int
