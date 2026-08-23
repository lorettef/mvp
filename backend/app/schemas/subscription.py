from typing import List, Optional

from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: str
    name: str
    price: Optional[int] = None
    price_per_company: Optional[int] = None
    company_limit: Optional[int] = None
    ai_reports_limit: Optional[int] = None
    features: List[str]
