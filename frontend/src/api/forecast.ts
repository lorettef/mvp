import type { ForecastRequest, ForecastResponse } from '@/types/api'
import { api } from './client'

export const forecastApi = {
  predict: (data: ForecastRequest): Promise<ForecastResponse> => api.post('/forecast/predict', data).then((res) => res.data),
}
