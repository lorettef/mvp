import numpy as np
from typing import List, Dict
from app.schemas.forecast import ForecastRequest, ForecastResponse
import pandas as pd
from prophet import Prophet

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
    def prophet_forecast(history: List[float], months: int) -> Dict[str, List[float]]:
        """Прогноз с помощью Meta Prophet: тренд + доверительный интервал.

        Возвращает словарь с ключами:
            predictions — точечный прогноз (yhat)
            lower      — нижняя граница доверительного интервала
            upper      — верхняя граница доверительного интервала
        """
        if len(history) < 3:
            # Мало данных — fallback на полином с расширенным интервалом
            preds = ForecastService.polynomial_forecast(history, months, degree=2)
            return {
                "predictions": preds,
                "lower": [round(p * 0.85, 2) for p in preds],
                "upper": [round(p * 1.15, 2) for p in preds],
            }

        try:
            df = pd.DataFrame({
                "ds": pd.date_range(end="today", periods=len(history), freq="ME"),
                "y": history,
            })

            model = Prophet(
                yearly_seasonality=False,
                weekly_seasonality=False,
                daily_seasonality=False,
            )
            model.fit(df)

            future = model.make_future_dataframe(periods=months, freq="ME")
            forecast = model.predict(future)

            future_forecast = forecast.tail(months)
            predictions = [max(0.0, round(float(v), 2)) for v in future_forecast["yhat"]]
            lower = [max(0.0, round(float(v), 2)) for v in future_forecast["yhat_lower"]]
            upper = [max(0.0, round(float(v), 2)) for v in future_forecast["yhat_upper"]]

            return {"predictions": predictions, "lower": lower, "upper": upper}
        except Exception:
            preds = ForecastService.polynomial_forecast(history, months, degree=2)
            return {
                "predictions": preds,
                "lower": [round(p * 0.85, 2) for p in preds],
                "upper": [round(p * 1.15, 2) for p in preds],
            }

    async def predict(self, request: ForecastRequest) -> ForecastResponse:
        """Основной метод прогнозирования."""

        if request.method == "prophet":
            result = self.prophet_forecast(request.history, request.months)
            predictions = result["predictions"]
            confidence_interval = {
                "lower": result["lower"],
                "upper": result["upper"],
            }
        elif request.method == "polynomial":
            predictions = self.polynomial_forecast(request.history, request.months, degree=2)
            confidence_interval = {
                "lower": [round(p * 0.9, 2) for p in predictions],
                "upper": [round(p * 1.1, 2) for p in predictions],
            }
        else:
            predictions = self.linear_forecast(request.history, request.months)
            confidence_interval = None

        return ForecastResponse(
            predictions=predictions,
            confidence_interval=confidence_interval,
            method=request.method,
        )
