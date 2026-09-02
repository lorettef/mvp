import type { ForecastRequest, ForecastResponse } from '@/types/api'
import { api } from './client'

export const forecastApi = {
  predict: (data: ForecastRequest, { signal }: { signal?: AbortSignal } = {}): Promise<ForecastResponse> => api.post('/forecast/predict', data, { signal }).then((res) => res.data),
}
