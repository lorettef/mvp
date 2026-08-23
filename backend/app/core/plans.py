from typing import List, Optional

PLANS: List[dict] = [
    {
        "id": "starter",
        "name": "Starter",
        "price": 0,
        "price_per_company": 0,
        "company_limit": 2,
        "ai_reports_limit": 1,
        "features": [
            "Демо-доступ на 3 месяца",
            "Базовый дашборд",
            "1 AI-отчёт в месяц",
        ],
    },
    {
        "id": "pro",
        "name": "Pro",
        "price": 19000,
        "price_per_company": 1900,
        "company_limit": 10,
        "ai_reports_limit": 5,
        "features": [
            "Всё из Starter",
            "Когортный анализ",
            "Экспорт Excel",
            "5 AI-отчётов в месяц",
        ],
    },
    {
        "id": "business",
        "name": "Business",
        "price": 39000,
        "price_per_company": 2900,
        "company_limit": 25,
        "ai_reports_limit": None,
        "features": [
            "Всё из Pro",
            "Полный финансовый модуль (P&L, Cash Flow, Оценка)",
            "PDF-отчёты для инвесторов",
        ],
    },
    {
        "id": "enterprise",
        "name": "Enterprise",
        "price": None,
        "price_per_company": None,
        "company_limit": None,
        "ai_reports_limit": None,
        "features": [
            "Всё из Business",
            "Более 25 компаний",
            "Индивидуальная кастомизация",
        ],
    },
]

DEFAULT_PLAN = "starter"
_ALIASES = {"free": "starter"}


def normalize_plan(plan: Optional[str]) -> str:
    if not plan:
        return DEFAULT_PLAN
    key = plan.strip().lower()
    if key in _ALIASES:
        return _ALIASES[key]
    return key if any(p["id"] == key for p in PLANS) else DEFAULT_PLAN


def get_plan(plan: Optional[str]) -> dict:
    key = normalize_plan(plan)
    for p in PLANS:
        if p["id"] == key:
            return p
    return PLANS[0]


def company_limit(plan: Optional[str]) -> Optional[int]:
    return get_plan(plan).get("company_limit")


def ai_reports_limit(plan: Optional[str]) -> Optional[int]:
    """Лимит AI-запросов по тарифу (None — безлимит)."""
    return get_plan(plan).get("ai_reports_limit")
