import type { MarketAnalysisRequest, MarketAnalysisResponse } from '@/types/api'
import { api } from './client'

export const marketApi = {
  analyze: (data: MarketAnalysisRequest, { signal }: { signal?: AbortSignal } = {}): Promise<MarketAnalysisResponse> =>
    api.post('/market/analyze', data, { signal }).then((res) => res.data),
}
