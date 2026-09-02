import type { MetricsRequest, RecommendationResponse } from '@/types/api'
import { api } from './client'

export const recommendationsApi = {
  get: (data: { metrics: MetricsRequest }, { signal }: { signal?: AbortSignal } = {}): Promise<RecommendationResponse> =>
    api.post('/recommendations/get', data, { signal }).then((res) => res.data),
}
