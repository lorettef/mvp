from typing import List, Dict, Any
from app.schemas.ai_metrics import MetricsRequest, MetricsResponse

class AnalyticsService:
    """Сервис аналитики юнит-экономики."""
    
    @staticmethod
    def analyze_metrics(metrics: MetricsRequest) -> MetricsResponse:
        """Анализирует метрики и выдаёт оценку состояния."""
        
        ltv_cac = metrics.ltv / metrics.cac if metrics.cac > 0 else 0
        
        alerts = []
        healthy = True
        
        # Проверка LTV/CAC
        if ltv_cac < 3:
            alerts.append(f"⚠️ LTV/CAC = {ltv_cac:.2f} (норма > 3). Клиенты не окупаются.")
            healthy = False
        elif ltv_cac < 4:
            alerts.append(f"📊 LTV/CAC = {ltv_cac:.2f} (норма > 3). Есть потенциал для улучшения.")
        else:
            alerts.append(f"✅ LTV/CAC = {ltv_cac:.2f} — отличный показатель!")
        
        # Проверка Churn
        if metrics.churn > 0.05:
            alerts.append(f"⚠️ Churn = {metrics.churn*100:.1f}% (норма < 5%). Высокий отток.")
            if metrics.churn > 0.08:
                healthy = False
        else:
            alerts.append(f"✅ Churn = {metrics.churn*100:.1f}% — в норме.")
        
        # Проверка Runway
        if metrics.runway_months < 6:
            alerts.append(f"⚠️ Runway = {metrics.runway_months:.1f} мес. (критично < 6 мес.)")
            healthy = False
        elif metrics.runway_months < 12:
            alerts.append(f"📊 Runway = {metrics.runway_months:.1f} мес. (рекомендуется > 12 мес.)")
        else:
            alerts.append(f"✅ Runway = {metrics.runway_months:.1f} мес. — хороший запас.")
        
        return MetricsResponse(
            mrr=metrics.mrr,
            cac=metrics.cac,
            ltv=metrics.ltv,
            churn=metrics.churn,
            arpu=metrics.arpu,
            runway_months=metrics.runway_months,
            ltv_cac_ratio=ltv_cac,
            healthy=healthy,
            alerts=alerts
        )
