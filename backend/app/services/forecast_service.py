import numpy as np
from typing import List, Optional
from app.schemas.forecast import ForecastRequest, ForecastResponse

class ForecastService:
    """Сервис прогнозирования."""
    
    @staticmethod
    def linear_forecast(history: List[float], months: int) -> List[float]:
        """Линейная регрессия для прогноза."""
        if not history:
            return [0.0] * months
            
        if len(history) < 2:
            last = history[-1] if history else 0.0
            return [round(last * (1 + 0.05 * i), 2) for i in range(1, months + 1)]
        
        try:
            x = np.arange(len(history), dtype=np.float64)
            y = np.array(history, dtype=np.float64)
            slope, intercept = np.polyfit(x, y, 1)
            future_x = np.arange(len(history), len(history) + months, dtype=np.float64)
            predictions = slope * future_x + intercept
            return [max(0.0, round(float(p), 2)) for p in predictions]
        except Exception:
            last = history[-1]
            return [round(last * (1 + 0.05 * i), 2) for i in range(1, months + 1)]
    
    @staticmethod
    def polynomial_forecast(history: List[float], months: int, degree: int = 2) -> List[float]:
        """Полиномиальная регрессия (квадратичная по умолчанию) — S-образный SaaS-рост."""
        if not history:
            return [0.0] * months
        if len(history) < 3:
            return ForecastService.linear_forecast(history, months)
        
        try:
            X = np.array(range(len(history)), dtype=np.float64)
            y = np.array(history, dtype=np.float64)
            coeffs = np.polyfit(X, y, deg=min(degree, len(history) - 1))
            future_X = np.array(range(len(history), len(history) + months), dtype=np.float64)
            predictions = np.polyval(coeffs, future_X)
            return [max(0.0, round(float(p), 2)) for p in predictions]
        except Exception:
            return ForecastService.linear_forecast(history, months)
    
    @staticmethod
    def prophet_forecast(history: List[float], months: int) -> List[float]:
        return ForecastService.polynomial_forecast(history, months, degree=2)
    
    async def predict(self, request: ForecastRequest) -> ForecastResponse:
        """Основной метод прогнозирования."""
        
        if request.method == "polynomial":
            predictions = self.polynomial_forecast(request.history, request.months, degree=2)
        elif request.method == "prophet":
            predictions = self.prophet_forecast(request.history, request.months)
        else:
            predictions = self.linear_forecast(request.history, request.months)
        
        response = ForecastResponse(
            predictions=predictions,
            method=request.method,
        )
        
        if request.method in ("polynomial", "prophet"):
            response.confidence_interval = {
                "lower": [round(p * 0.9, 2) for p in predictions],
                "upper": [round(p * 1.1, 2) for p in predictions],
            }
        
        return response