import json
import logging
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx
from app.core.config import settings
from app.models.ai_cache import AICache
from app.schemas.metrics import MetricsRequest
from uuid import UUID
from app.schemas.recommendations import RecommendationResponse, RecommendationAction

logger = logging.getLogger(__name__)

class AIService:
    """Сервис для работы с AI-провайдерами (DeepSeek, GigaChat, Demo)."""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.cache_ttl_hours = 24
    
    async def get_recommendations(self, metrics: MetricsRequest, user_id: str) -> RecommendationResponse:
        """Получить AI-рекомендации на основе метрик."""
        
        metrics_hash = self._hash_metrics(metrics)
        cached = await self._get_cached(metrics_hash)
        if cached:
            return cached
        
        logger.info("AI request: provider=%s", settings.AI_PROVIDER)
        
        if settings.AI_PROVIDER == "demo":
            response = self._generate_demo_recommendations(metrics)
            await self._cache_response(metrics_hash, response, user_id)
            return response
        
        try:
            if settings.AI_PROVIDER == "deepseek":
                response = await self._call_deepseek(metrics)
            else:
                response = await self._call_gigachat(metrics)
            await self._cache_response(metrics_hash, response, user_id)
            return response
        except Exception:
            logger.error(f"{settings.AI_PROVIDER} API call failed, falling back to demo", exc_info=True)
            response = self._generate_demo_recommendations(metrics)
            await self._cache_response(metrics_hash, response, user_id)
            return response
    
    def _hash_metrics(self, metrics: MetricsRequest) -> str:
        """Создаёт хеш от метрик для кэширования."""
        data = {
            "mrr": metrics.mrr,
            "cac": metrics.cac,
            "ltv": metrics.ltv,
            "churn": metrics.churn,
            "arpu": metrics.arpu,
            "runway": metrics.runway_months,
            "stage": metrics.stage
        }
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()
    
    async def _get_cached(self, metrics_hash: str) -> Optional[RecommendationResponse]:
        """Получает ответ из кэша."""
        try:
            result = await self.db.execute(
                select(AICache).where(
                    AICache.metrics_hash == metrics_hash,
                    AICache.expires_at > datetime.now(timezone.utc).replace(tzinfo=None)
                )
            )
            cached = result.scalar_one_or_none()
            if cached:
                data = json.loads(cached.response)
                return RecommendationResponse(**data)
        except Exception:
            logger.debug("Cache miss or read error", exc_info=True)
        return None
    
    async def _cache_response(self, metrics_hash: str, response: RecommendationResponse, user_id: str) -> None:
        """Сохраняет ответ в кэш."""
        try:
            cache_entry = AICache(
                user_id=UUID(user_id),
                metrics_hash=metrics_hash,
                response=json.dumps(response.model_dump()),
                expires_at=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=self.cache_ttl_hours)
            )
            self.db.add(cache_entry)
            await self.db.flush()
        except Exception:
            await self.db.rollback()
    
    def _build_prompt(self, metrics: MetricsRequest) -> str:
        """Формирует промпт для AI с метриками компании."""
        return f"""
Ты — финансовый аналитик по юнит-экономике SaaS-стартапов.
Проанализируй следующие метрики компании:

- MRR: ${metrics.mrr:,.0f}
- CAC: ${metrics.cac:,.0f}
- LTV: ${metrics.ltv:,.0f}
- Churn: {metrics.churn*100:.1f}%
- ARPU: ${metrics.arpu:,.0f}
- Runway: {metrics.runway_months:.1f} месяцев
- Стадия: {metrics.stage}

Рассчитай LTV/CAC = {metrics.ltv/metrics.cac:.2f}

Дай 3 конкретные рекомендации по улучшению этих метрик.
Каждая рекомендация должна содержать:
1. Название (короткое)
2. Описание (что именно сделать)
3. Приоритет (high/medium/low)
4. Категорию (marketing/product/sales/retention)

Ответ должен быть в формате JSON:
{{
    "summary": "Краткий вывод по компании",
    "recommendations": [
        {{
            "title": "Название",
            "description": "Описание",
            "priority": "high",
            "category": "marketing"
        }}
    ]
}}
"""
    
    def _parse_ai_response(self, content: str, metrics: MetricsRequest) -> RecommendationResponse:
        """Парсит JSON-ответ от AI, с fallback на демо при ошибке."""
        try:
            json_start = content.find('{')
            json_end = content.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                data = json.loads(content[json_start:json_end])
                return RecommendationResponse(**data)
            raise ValueError("JSON не найден в ответе")
        except (json.JSONDecodeError, KeyError, ValueError):
            return self._generate_demo_recommendations(metrics)
    
    async def _call_deepseek(self, metrics: MetricsRequest) -> RecommendationResponse:
        """Вызов DeepSeek API (OpenAI-совместимый)."""
        if not settings.DEEPSEEK_API_KEY:
            raise ValueError("DEEPSEEK_API_KEY не задан")
        
        logger.info("Calling DeepSeek API: %s/chat/completions model=%s", 
                     settings.DEEPSEEK_BASE_URL, settings.DEEPSEEK_MODEL)
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.DEEPSEEK_BASE_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": settings.DEEPSEEK_MODEL,
                    "messages": [
                        {"role": "system", "content": "Ты аналитик по юнит-экономике. Отвечай строго в формате JSON."},
                        {"role": "user", "content": self._build_prompt(metrics)}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1000,
                }
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return self._parse_ai_response(content, metrics)
    
    async def _call_gigachat(self, metrics: MetricsRequest) -> RecommendationResponse:
        """Вызов GigaChat API (Сбер)."""
        if not settings.GIGACHAT_AUTH_KEY:
            raise ValueError("GIGACHAT_AUTH_KEY не задан")
        
        prompt = self._build_prompt(metrics)
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            auth_response = await client.post(
                f"{settings.GIGACHAT_API_URL}/auth",
                headers={
                    "Authorization": f"Bearer {settings.GIGACHAT_AUTH_KEY}",
                    "RqUID": settings.GIGACHAT_CLIENT_ID,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data={"scope": settings.GIGACHAT_SCOPE}
            )
            auth_response.raise_for_status()
            auth_data = auth_response.json()
            access_token = auth_data.get("access_token")
            
            if not access_token:
                raise ValueError("Не удалось получить токен доступа GigaChat")
            
            response = await client.post(
                f"{settings.GIGACHAT_API_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "GigaChat",
                    "messages": [
                        {"role": "system", "content": "Ты аналитик по юнит-экономике. Отвечай строго в формате JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 1000
                }
            )
            response.raise_for_status()
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            return self._parse_ai_response(content, metrics)
    
    def _generate_demo_recommendations(self, metrics: MetricsRequest) -> RecommendationResponse:
        """Генерирует демо-рекомендации (без реального AI)."""
        
        ltv_cac = metrics.ltv / metrics.cac if metrics.cac > 0 else 0
        recommendations = []
        alerts = []
        
        # Анализ LTV/CAC
        if ltv_cac < 3:
            alerts.append("⚠️ LTV/CAC < 3 — это критично. Нужно снижать CAC или увеличивать LTV.")
            recommendations.append(
                RecommendationAction(
                    title="Оптимизация маркетинговых каналов",
                    description="Отключите неэффективные каналы привлечения. Сосредоточьтесь на каналах с самым низким CAC. Проведите A/B-тестирование креативов.",
                    priority="high",
                    category="marketing"
                )
            )
            recommendations.append(
                RecommendationAction(
                    title="Увеличение LTV через апсейл",
                    description="Внедрите систему апсейлов и кросс-сейлов. Предложите существующим клиентам дополнительные функции или услуги.",
                    priority="high",
                    category="product"
                )
            )
        
        # Анализ Churn
        if metrics.churn > 0.05:
            alerts.append(f"⚠️ Churn {metrics.churn*100:.1f}% — выше среднего по рынку (3-5%).")
            recommendations.append(
                RecommendationAction(
                    title="Снижение оттока клиентов",
                    description=f"Проведите анализ причин оттока. Внедрите NPS-опрос после 30 дней использования. Сделайте персонализированный онбординг.",
                    priority="high",
                    category="retention"
                )
            )
        
        # Анализ Runway
        if metrics.runway_months < 6:
            alerts.append(f"⚠️ Runway {metrics.runway_months:.1f} месяцев — менее 6 месяцев. Критически важно увеличить выручку или привлечь инвестиции.")
            recommendations.append(
                RecommendationAction(
                    title="Увеличение выручки",
                    description="Внедрите годовую подписку со скидкой 15-20% для увеличения денежного потока. Запустите промо-акции для привлечения новых клиентов.",
                    priority="high",
                    category="sales"
                )
            )
        
        # Если всё хорошо
        if not alerts:
            recommendations.append(
                RecommendationAction(
                    title="Масштабирование успешных каналов",
                    description=f"Ваши метрики в норме (LTV/CAC = {ltv_cac:.2f}). Увеличьте бюджет на каналы с лучшей окупаемостью в 1.5-2 раза.",
                    priority="medium",
                    category="marketing"
                )
            )
            recommendations.append(
                RecommendationAction(
                    title="Повышение ARPU",
                    description="Внедрите новый премиум-тариф с расширенными функциями. Протестируйте повышение цены на 10-15% для новых клиентов.",
                    priority="medium",
                    category="product"
                )
            )
        
        # Если мало рекомендаций — добавляем базовые
        if len(recommendations) < 3:
            if not any(r.title == "Развитие партнёрской программы" for r in recommendations):
                recommendations.append(
                    RecommendationAction(
                        title="Развитие партнёрской программы",
                        description="Запустите реферальную программу для существующих клиентов. Предложите скидку 20% за каждого приведённого клиента.",
                        priority="low",
                        category="sales"
                    )
                )
            if not any(r.title == "Автоматизация продаж" for r in recommendations):
                recommendations.append(
                    RecommendationAction(
                        title="Автоматизация продаж",
                        description="Внедрите CRM-систему для отслеживания воронки продаж. Настройте автоматические напоминания для менеджеров.",
                        priority="low",
                        category="sales"
                    )
                )
        
        summary = f"Ваша компания на стадии {metrics.stage.replace('_', ' ')}. "
        if ltv_cac < 3:
            summary += "Ключевая проблема: окупаемость клиентов. "
        elif metrics.churn > 0.05:
            summary += "Ключевая проблема: высокий отток. "
        else:
            summary += "Метрики в норме. Фокус на масштабирование. "
        summary += f"LTV/CAC = {ltv_cac:.2f}, Runway = {metrics.runway_months:.1f} мес."
        
        return RecommendationResponse(
            summary=summary,
            recommendations=recommendations[:5],
            raw_response=None,
        )