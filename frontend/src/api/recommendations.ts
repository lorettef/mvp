import type { MetricsRequest, RecommendationResponse } from '@/types/api'
import { api } from './client'

export const recommendationsApi = {
  get: (data: { metrics: MetricsRequest }): Promise<RecommendationResponse> =>
    api.post('/recommendations/get', data).then((res) => res.data),
}
