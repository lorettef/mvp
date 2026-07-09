import type { MetricsRequest, MetricsResponse } from '@/types/api'
import { api } from './client'

export const metricsApi = {
  analyze: (data: MetricsRequest): Promise<MetricsResponse> => api.post('/metrics/analyze', data).then((res) => res.data),
}
