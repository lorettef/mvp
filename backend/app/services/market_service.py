from app.schemas.market import (
    MarketAnalysisRequest,
    MarketAnalysisResponse,
    MacroIndicators,
    MarketImpact,
)

GEOGRAPHIES = {
    "RU": {"label": "Россия", "gdp_growth": 3.5, "inflation": 8.5, "key_rate": 21.0, "scale": 1.0},
    "KZ": {"label": "Казахстан", "gdp_growth": 4.5, "inflation": 8.0, "key_rate": 16.0, "scale": 0.08},
    "global": {"label": "Глобальный рынок", "gdp_growth": 3.0, "inflation": 4.5, "key_rate": 4.0, "scale": 25.0},
}

INDUSTRIES = {
    "saas": {
        "label": "SaaS",
        "size": 300.0,
        "growth": 15.0,
        "trends": [
            "Сдвиг к AI-функциям внутри продуктов",
            "Рост self-serve и product-led growth",
            "Консолидация нишевых решений",
        ],
    },
    "fintech": {
        "label": "Fintech",
        "size": 450.0,
        "growth": 20.0,
        "trends": [
            "Рост цифровых платежей",
            "Встроенные финансы (embedded finance)",
            "Регуляторное давление на комиссии",
        ],
    },
    "ecommerce": {
        "label": "E-commerce",
        "size": 800.0,
        "growth": 18.0,
        "trends": [
            "Доминирование маркетплейсов",
            "Рост логистики last-mile",
            "Социальная коммерция",
        ],
    },
    "edtech": {
        "label": "EdTech",
        "size": 80.0,
        "growth": 12.0,
        "trends": [
            "Рост корпоративного обучения",
            "Микрообучение и AI-тьюторы",
            "B2B-сегмент обгоняет B2C",
        ],
    },
    "healthtech": {
        "label": "HealthTech",
        "size": 150.0,
        "growth": 14.0,
        "trends": [
            "Телемедицина становится нормой",
            "AI-диагностика",
            "Госпрограммы цифровизации",
        ],
    },
    "ai": {
        "label": "AI/ML",
        "size": 200.0,
        "growth": 35.0,
        "trends": [
            "Генеративный AI в каждом продукте",
            "Рост спроса на AI-инфраструктуру",
            "Дефицит специалистов",
        ],
    },
    "other": {
        "label": "Другое",
        "size": 100.0,
        "growth": 10.0,
        "trends": [
            "Общая цифровизация",
            "Импортозамещение",
            "Рост B2B-сегмента",
        ],
    },
}


class MarketAnalysisService:
    """Внешний анализ рынка: макро + объём рынка + тренды + влияние на метрики."""

    def analyze(self, req: MarketAnalysisRequest) -> MarketAnalysisResponse:
        geo = GEOGRAPHIES[req.geography]
        ind = INDUSTRIES[req.industry]

        market_size = round(ind["size"] * geo["scale"], 1)
        projected = round(market_size * (1 + ind["growth"] / 100) ** req.horizon, 1)

        mrr_factor = round(1 + geo["gdp_growth"] / 100 - geo["inflation"] / 100 * 0.3, 3)
        cac_factor = round(1 + geo["inflation"] / 100 + geo["key_rate"] / 100 * 0.2, 3)
        churn_factor = round(1 + geo["inflation"] / 100 * 0.5, 3)

        summary = (
            f"{ind['label']} в географии «{geo['label']}»: объём рынка ≈ {market_size:.0f} ₽ млрд, "
            f"рост {ind['growth']:.0f}%/год (за {req.horizon} г. → {projected:.0f} ₽ млрд). "
            f"Макро: ВВП +{geo['gdp_growth']:.1f}%, инфляция {geo['inflation']:.1f}%, "
            f"ключевая ставка {geo['key_rate']:.1f}%."
        )

        return MarketAnalysisResponse(
            industry=req.industry,
            industry_label=ind["label"],
            geography=req.geography,
            geography_label=geo["label"],
            horizon=req.horizon,
            macro=MacroIndicators(
                gdp_growth=geo["gdp_growth"],
                inflation=geo["inflation"],
                key_rate=geo["key_rate"],
            ),
            market_size=market_size,
            market_size_projected=projected,
            market_growth=ind["growth"],
            trends=ind["trends"],
            impact=MarketImpact(
                mrr_factor=mrr_factor,
                cac_factor=cac_factor,
                churn_factor=churn_factor,
            ),
            summary=summary,
        )
