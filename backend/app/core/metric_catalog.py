"""Data-driven catalog of recommended metrics per industry and business model.

This module models the relationship `industry → business model → recommended
metrics` as pure configuration. There are no `if industry == "SaaS"` branches:
the catalog is a set of dictionaries and a few read-only accessor helpers.
Presentation/recommendation layer only — it maps onto the fixed `Metric` model
vocabulary but never touches the database or the API layer.

Metric keys (`metric["key"]`) are drawn from the fixed `Metric` column set:
    new_units, arpu, revenue, marketing_spend, retention_rate
Derived keys are drawn from:
    churn, ltv, cac
(see `app/models/metric.py`; churn/ltv/cac are derived columns, not inputs.)

Two independent namespaces:
  * `INDUSTRIES` — industry slugs (source of truth: the frontend `MarketIndustry`
    enum in `frontend/src/types/api.ts`).
  * `BUSINESS_MODELS` — business-model slugs, kept distinct from industry slugs.

Slug collisions: the industry namespace is canonical. Two business models share
their natural name with an industry slug and are therefore disambiguated here:
    industry `fintech`     vs  business model `financial_services`
    industry `ecommerce`   vs  business model `retail`
The industry keeps the slug; the business model uses the disambiguated slug.
Also note `marketplace` (business model) vs `marketplaces` (industry) — distinct
strings, but kept separate on purpose.
"""

# Fixed metric vocabulary (input columns on the `Metric` model).
METRIC_KEYS: tuple[str, ...] = (
    "new_units",
    "arpu",
    "revenue",
    "marketing_spend",
    "retention_rate",
)

# Derived metric vocabulary (derived columns on the `Metric` model).
DERIVED_KEYS: list[str] = ["churn", "ltv", "cac"]

# How each derived metric is computed from the input metrics (documentation only).
DERIVED_FORMULAS: dict[str, str] = {
    "churn": "1 − retention_rate",
    "ltv": "arpu × (1 / churn)",
    "cac": "marketing_spend / new_units",
}

# ---------------------------------------------------------------------------
# Business models — separate namespace from industries.
# ---------------------------------------------------------------------------
BUSINESS_MODELS: dict[str, dict[str, str]] = {
    "subscription": {
        "label": "Подписка (SaaS)",
        "description": "Повторяющаяся выручка от подписки на продукт или сервис.",
    },
    "marketplace": {
        "label": "Маркетплейс",
        "description": "Двусторонняя платформа с доходом от комиссии со сделок.",
    },
    # Disambiguated from the industry slug `ecommerce`.
    "retail": {
        "label": "Онлайн-ритейл",
        "description": "Прямая продажа товаров через собственный интернет-магазин.",
    },
    # Disambiguated from the industry slug `fintech`.
    "financial_services": {
        "label": "Финансовые сервисы",
        "description": "Доход от комиссий и процентной маржи (платежи, кредитование, страхование).",
    },
    "mobile_app": {
        "label": "Мобильное приложение",
        "description": "Монетизация через подписки, in-app покупки и рекламу.",
    },
    "services": {
        "label": "Сервисы / Аутсорсинг",
        "description": "Выручка от проектов и контрактов (консалтинг, агентство, услуги).",
    },
}

# ---------------------------------------------------------------------------
# Industries — canonical set (source of truth: frontend `MarketIndustry` enum).
#
# Divergence notes (reconciled 2026-09-03):
#   * `frontend/src/types/api.ts` `MarketIndustry` — 15 slugs (full set below).
#   * `app/services/market_service.py` `INDUSTRIES` — matches the frontend 1:1
#     (same 15 slugs, same labels). No divergence.
#   * `app/services/hiring_service.py` `INDUSTRY_LABELS` — only 7 entries
#     (saas, fintech, ecommerce, edtech, healthtech, ai, other); it omits
#     marketplaces, foodtech, logistics, proptech, media, hardware, biotech,
#     cleantech. Its `INDUSTRY_STAFF_MIX` already covers all 15, so this looks
#     like an incomplete label map rather than a different taxonomy. This module
#     follows the frontend enum (15 industries).
# ---------------------------------------------------------------------------
INDUSTRIES: dict[str, dict[str, str]] = {
    "saas": {"label": "SaaS"},
    "fintech": {"label": "Fintech"},
    "ecommerce": {"label": "E-commerce"},
    "edtech": {"label": "EdTech"},
    "healthtech": {"label": "HealthTech"},
    "ai": {"label": "AI/ML"},
    "marketplaces": {"label": "Маркетплейсы"},
    "foodtech": {"label": "FoodTech"},
    "logistics": {"label": "Логистика"},
    "proptech": {"label": "PropTech"},
    "media": {"label": "Медиа и развлечения"},
    "hardware": {"label": "Hardware / IoT"},
    "biotech": {"label": "Biotech"},
    "cleantech": {"label": "CleanTech"},
    "other": {"label": "Другое"},
}

# ---------------------------------------------------------------------------
# Per-business-model metric templates (label + required + why).
# ---------------------------------------------------------------------------
_BM_METRICS: dict[str, list[dict]] = {
    "subscription": [
        {
            "key": "new_units",
            "label": "Новые платящие клиенты",
            "required": True,
            "why": "Поток новых подписчиков — главный драйвер роста подписочной выручки.",
        },
        {
            "key": "arpu",
            "label": "Средняя выручка на клиента",
            "required": True,
            "why": "Средний доход с одного подписчика за период показывает ценность клиента.",
        },
        {
            "key": "revenue",
            "label": "Повторяющаяся выручка (MRR/ARR)",
            "required": True,
            "why": "Повторяющаяся выручка — ключевой показатель устойчивости подписки.",
        },
        {
            "key": "marketing_spend",
            "label": "Расходы на привлечение",
            "required": True,
            "why": "Затраты на маркетинг, из которых рассчитывается CAC.",
        },
        {
            "key": "retention_rate",
            "label": "Удержание подписчиков",
            "required": True,
            "why": "Доля подписчиков, оставшихся после периода, — главный драйвер LTV.",
        },
    ],
    "marketplace": [
        {
            "key": "new_units",
            "label": "Новые активные покупатели",
            "required": True,
            "why": "Приток новых покупателей на платформу определяет рост GMV.",
        },
        {
            "key": "arpu",
            "label": "Комиссия с транзакции (take rate)",
            "required": True,
            "why": "Доля платформы в каждой сделке — источник монетизации маркетплейса.",
        },
        {
            "key": "revenue",
            "label": "Выручка платформы (комиссии)",
            "required": True,
            "why": "Комиссионный доход — главная монетизация двустороннего маркетплейса.",
        },
        {
            "key": "marketing_spend",
            "label": "Расходы на привлечение (обе стороны)",
            "required": True,
            "why": "Затраты на привлечение и продавцов, и покупателей.",
        },
        {
            "key": "retention_rate",
            "label": "Возвращаемость покупателей",
            "required": True,
            "why": "Повторные покупки — основа LTV и ликвидности платформы.",
        },
    ],
    "retail": [
        {
            "key": "new_units",
            "label": "Новые заказы",
            "required": True,
            "why": "Поток новых заказов — драйвер выручки интернет-магазина.",
        },
        {
            "key": "arpu",
            "label": "Средний чек (AOV)",
            "required": True,
            "why": "Средняя сумма заказа показывает ценность покупки.",
        },
        {
            "key": "revenue",
            "label": "Выручка от продаж",
            "required": True,
            "why": "Оборот магазина за период — главный показатель ритейла.",
        },
        {
            "key": "marketing_spend",
            "label": "Расходы на маркетинг и рекламу",
            "required": True,
            "why": "Затраты на трафик и привлечение заказов.",
        },
        {
            "key": "retention_rate",
            "label": "Повторные покупки",
            "required": True,
            "why": "Доля вернувшихся покупателей — ключ к LTV в ритейле.",
        },
    ],
    "financial_services": [
        {
            "key": "new_units",
            "label": "Новые активные клиенты",
            "required": True,
            "why": "Приток новых клиентов — база роста кредитного/платёжного портфеля.",
        },
        {
            "key": "arpu",
            "label": "Доход на клиента (комиссии и проценты)",
            "required": True,
            "why": "Средний доход с клиента от комиссий и процентной маржи.",
        },
        {
            "key": "revenue",
            "label": "Процентный и комиссионный доход",
            "required": True,
            "why": "Основной доход финтех-платформы от комиссий и процентной маржи.",
        },
        {
            "key": "marketing_spend",
            "label": "Расходы на привлечение",
            "required": True,
            "why": "Затраты на CAC — критичны при регуляторных ограничениях на стоимость риска.",
        },
        {
            "key": "retention_rate",
            "label": "Удержание активных счетов",
            "required": True,
            "why": "Доля клиентов, остающихся активными, определяет качество портфеля.",
        },
    ],
    "mobile_app": [
        {
            "key": "new_units",
            "label": "Новые активные пользователи",
            "required": True,
            "why": "Прирост активной аудитории — база монетизации приложения.",
        },
        {
            "key": "arpu",
            "label": "Доход на пользователя (ARPU)",
            "required": True,
            "why": "Средний доход с пользователя (подписки, IAP, реклама).",
        },
        {
            "key": "revenue",
            "label": "Выручка приложения",
            "required": True,
            "why": "Совокупный доход от всех каналов монетизации.",
        },
        {
            "key": "marketing_spend",
            "label": "Расходы на привлечение (UA)",
            "required": True,
            "why": "Затраты на установки и активацию пользователей.",
        },
        {
            "key": "retention_rate",
            "label": "Удержание пользователей",
            "required": True,
            "why": "Доля пользователей, возвращающихся в приложение, — драйвер LTV.",
        },
    ],
    "services": [
        {
            "key": "new_units",
            "label": "Новые клиенты / контракты",
            "required": True,
            "why": "Число новых контрактов — драйвер загрузки команды и выручки.",
        },
        {
            "key": "arpu",
            "label": "Средний чек по контракту",
            "required": True,
            "why": "Средняя стоимость проекта или контракта.",
        },
        {
            "key": "revenue",
            "label": "Выручка от услуг",
            "required": True,
            "why": "Доход от оказанных услуг за период.",
        },
        {
            "key": "marketing_spend",
            "label": "Расходы на маркетинг и продажи",
            "required": True,
            "why": "Затраты на лидогенерацию и продажи.",
        },
        {
            "key": "retention_rate",
            "label": "Продление контрактов",
            "required": True,
            "why": "Доля продлённых контрактов — стабильность выручки сервисного бизнеса.",
        },
    ],
}


def _profile(business_model_slug: str, label: str, why: str) -> dict:
    """Build a profile dict for a (industry, business-model) combination."""
    return {
        "label": label,
        "why": why,
        "metrics": [dict(m) for m in _BM_METRICS[business_model_slug]],
        "derived": list(DERIVED_KEYS),
    }


def _generic_profile(business_model_slug: str) -> dict:
    """Generic fallback profile for a business model without a specific mapping."""
    bm = BUSINESS_MODELS[business_model_slug]
    return _profile(
        business_model_slug,
        bm["label"],
        f"Универсальный набор метрик для бизнес-модели «{bm['label']}».",
    )


# ---------------------------------------------------------------------------
# Industry → business model → profile.
# Each profile's `why` explains why THIS metric set fits THIS industry and
# business model. All 6 business models are covered across the industries where
# they make sense; `other` acts as the catch-all for every business model.
# ---------------------------------------------------------------------------
INDUSTRY_PROFILES: dict[str, dict[str, dict]] = {
    "saas": {
        "subscription": _profile(
            "subscription",
            "SaaS-подписка",
            "Подписка — ядро SaaS: выручка растёт за счёт новых клиентов и "
            "удержания, поэтому набор фокусируется на привлечении, ARPU и retention.",
        ),
        "mobile_app": _profile(
            "mobile_app",
            "Мобильный SaaS-продукт",
            "Мобильный SaaS монетизируется подпиской и IAP, поэтому важны новые "
            "пользователи и удержание аудитории.",
        ),
    },
    "fintech": {
        "financial_services": _profile(
            "financial_services",
            "Финтех-платформа",
            "Доход финтеха — комиссии и процентная маржа, поэтому ключевые метрики: "
            "новые клиенты, доход на клиента и удержание счетов.",
        ),
        "subscription": _profile(
            "subscription",
            "Fintech-подписка (SaaS)",
            "Fintech-подписка (например, банкинг-платформа) опирается на повторяющуюся "
            "выручку и удержание клиентов.",
        ),
        "marketplace": _profile(
            "marketplace",
            "Кредитный маркетплейс",
            "Кредитный маркетплейс зарабатывает на комиссии со сделок между "
            "заёмщиками и кредиторами.",
        ),
    },
    "ecommerce": {
        "retail": _profile(
            "retail",
            "Интернет-магазин",
            "Прямые продажи товаров: рост зависит от новых заказов, среднего чека и "
            "возвращаемости покупателей.",
        ),
        "marketplace": _profile(
            "marketplace",
            "Маркетплейс товаров",
            "Маркетплейс товаров монетизирует комиссию с транзакций продавцов и покупателей.",
        ),
        "subscription": _profile(
            "subscription",
            "Подписка на товары (DTC)",
            "Подписка на товары (DTC) строится на повторяющейся выручке и удержании подписчиков.",
        ),
    },
    "edtech": {
        "subscription": _profile(
            "subscription",
            "Подписка на обучение",
            "Обучение по подписке — повторяющаяся выручка, поэтому важны привлечение "
            "учеников и их удержание.",
        ),
        "marketplace": _profile(
            "marketplace",
            "Маркетплейс репетиторов",
            "Маркетплейс репетиторов зарабатывает на комиссии с занятий.",
        ),
        "mobile_app": _profile(
            "mobile_app",
            "Образовательное приложение",
            "Образовательное приложение монетизируется подпиской и IAP — ключ в новых "
            "пользователях и retention.",
        ),
    },
    "healthtech": {
        "subscription": _profile(
            "subscription",
            "Телемедицина по подписке",
            "Телемедицина по подписке — повторяющиеся консультации и удержание пациентов.",
        ),
        "marketplace": _profile(
            "marketplace",
            "Маркетплейс врачей / клиник",
            "Маркетплейс врачей и клиник зарабатывает на комиссии с записей.",
        ),
        "services": _profile(
            "services",
            "Медицинские услуги",
            "Медицинские услуги — выручка от приёмов и процедур, важны новые пациенты "
            "и повторные визиты.",
        ),
    },
    "ai": {
        "subscription": _profile(
            "subscription",
            "AI API / кредиты по подписке",
            "AI-платформа продаёт доступ по подписке или кредитам — важны новые клиенты, "
            "ARPU и retention.",
        ),
        "mobile_app": _profile(
            "mobile_app",
            "AI-приложение",
            "AI-приложение монетизируется подпиской и IAP — привлечение и удержание пользователей.",
        ),
        "services": _profile(
            "services",
            "AI-агентство / интеграция",
            "AI-агентство зарабатывает на проектах внедрения — новые контракты и средний чек.",
        ),
    },
    "marketplaces": {
        "marketplace": _profile(
            "marketplace",
            "Маркетплейс",
            "Ядро маркетплейса — комиссия с транзакций, поэтому важны обе стороны рынка "
            "и возвращаемость покупателей.",
        ),
        "retail": _profile(
            "retail",
            "Собственные продажи (1P)",
            "Собственные продажи маркетплейса (1P) учитываются как онлайн-ритейл.",
        ),
        "subscription": _profile(
            "subscription",
            "Подписка для селлеров",
            "Подписка для селлеров — повторяющийся доход от продавцов платформы.",
        ),
    },
    "foodtech": {
        "marketplace": _profile(
            "marketplace",
            "Маркетплейс доставки еды",
            "Доставка еды — маркетплейс ресторанов и клиентов, доход от комиссии с заказов.",
        ),
        "subscription": _profile(
            "subscription",
            "Подписка на наборы еды",
            "Подписка на наборы еды — повторяющаяся выручка и удержание подписчиков.",
        ),
        "mobile_app": _profile(
            "mobile_app",
            "Приложение доставки",
            "Приложение доставки монетизируется заказами и подпиской — новые пользователи "
            "и retention.",
        ),
    },
    "logistics": {
        "services": _profile(
            "services",
            "Логистические услуги",
            "Логистические услуги — выручка от перевозок и контрактов, важны новые "
            "клиенты и продление.",
        ),
        "marketplace": _profile(
            "marketplace",
            "Фрахтовый маркетплейс",
            "Фрахтовый маркетплейс сводит грузовладельцев и перевозчиков, доход от комиссии.",
        ),
        "subscription": _profile(
            "subscription",
            "SaaS для логистики",
            "SaaS для логистики — повторяющаяся выручка от подписки на ПО.",
        ),
    },
    "proptech": {
        "marketplace": _profile(
            "marketplace",
            "Маркетплейс недвижимости",
            "Маркетплейс недвижимости зарабатывает на комиссии со сделок.",
        ),
        "subscription": _profile(
            "subscription",
            "SaaS управления недвижимостью",
            "SaaS управления недвижимостью — подписочная выручка от УК и собственников.",
        ),
        "services": _profile(
            "services",
            "Услуги по недвижимости",
            "Услуги по недвижимости — выручка от сделок и обслуживания.",
        ),
    },
    "media": {
        "subscription": _profile(
            "subscription",
            "Стриминг по подписке",
            "Стриминг по подписке — повторяющаяся выручка от подписчиков и их удержания.",
        ),
        "mobile_app": _profile(
            "mobile_app",
            "Медиа-приложение",
            "Медиа-приложение монетизируется подпиской и рекламой — привлечение и удержание.",
        ),
        "marketplace": _profile(
            "marketplace",
            "Рекламный маркетплейс",
            "Рекламный маркетплейс — комиссия с размещения рекламы.",
        ),
    },
    "hardware": {
        "retail": _profile(
            "retail",
            "Продажи устройств",
            "Продажи устройств — новые заказы и средний чек.",
        ),
        "subscription": _profile(
            "subscription",
            "Hardware-as-a-Service",
            "Hardware-as-a-Service — повторяющаяся выручка от аренды устройств.",
        ),
        "services": _profile(
            "services",
            "Сервис и поддержка",
            "Сервис и поддержка — выручка от обслуживания и контрактов.",
        ),
    },
    "biotech": {
        "subscription": _profile(
            "subscription",
            "Платформа диагностики",
            "Платформа диагностики по подписке — повторяющаяся выручка от клиник и пациентов.",
        ),
        "services": _profile(
            "services",
            "R&D-услуги",
            "R&D-услуги — выручка от исследовательских контрактов.",
        ),
    },
    "cleantech": {
        "subscription": _profile(
            "subscription",
            "Energy-as-a-Service",
            "Energy-as-a-Service — повторяющаяся выручка от энергоснабжения.",
        ),
        "services": _profile(
            "services",
            "Инжиниринговые услуги",
            "Инжиниринговые услуги — выручка от проектов и монтажа.",
        ),
        "retail": _profile(
            "retail",
            "Продажа оборудования",
            "Продажа оборудования — новые заказы и средний чек.",
        ),
    },
    "other": {
        "subscription": _generic_profile("subscription"),
        "marketplace": _generic_profile("marketplace"),
        "retail": _generic_profile("retail"),
        "financial_services": _generic_profile("financial_services"),
        "mobile_app": _generic_profile("mobile_app"),
        "services": _generic_profile("services"),
    },
}

DEFAULT_INDUSTRY = "saas"
DEFAULT_BUSINESS_MODEL = "subscription"


# ---------------------------------------------------------------------------
# Accessor helpers.
# ---------------------------------------------------------------------------
def list_industries() -> list[dict]:
    """Return the canonical industries as `[{"slug", "label"}, ...]`."""
    return [
        {"slug": slug, "label": INDUSTRIES[slug]["label"]}
        for slug in INDUSTRIES
    ]


def list_business_models() -> list[dict]:
    """Return the business models as `[{"slug", "label", "description"}, ...]`."""
    return [
        {
            "slug": slug,
            "label": bm["label"],
            "description": bm["description"],
        }
        for slug, bm in BUSINESS_MODELS.items()
    ]


def business_models_for(industry_slug: str) -> list[str]:
    """Return the business-model slugs mapped to the given industry.

    Returns an empty list for an unknown industry (does not raise).
    """
    return list(INDUSTRY_PROFILES.get(industry_slug, {}).keys())


def get_profile(industry_slug: str, business_model_slug: str) -> dict:
    """Return the recommended-metrics profile for (industry, business model).

    Raises `KeyError` if either slug is unknown. Falls back to the business
    model's generic profile when the specific combination is not mapped, so a
    sensible profile exists for every (known industry, known business model).
    """
    if industry_slug not in INDUSTRIES:
        raise KeyError(f"Неизвестная индустрия: {industry_slug}")
    if business_model_slug not in BUSINESS_MODELS:
        raise KeyError(f"Неизвестная бизнес-модель: {business_model_slug}")

    profiles = INDUSTRY_PROFILES.get(industry_slug, {})
    if business_model_slug in profiles:
        return profiles[business_model_slug]
    return _generic_profile(business_model_slug)


def default_industry() -> str:
    """Return the default industry slug."""
    return DEFAULT_INDUSTRY


def default_business_model() -> str:
    """Return the default business-model slug."""
    return DEFAULT_BUSINESS_MODEL
