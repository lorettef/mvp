import type { MarketAnalysisRequest, MarketAnalysisResponse } from '@/types/api'
import { api } from './client'

export const marketApi = {
  analyze: (data: MarketAnalysisRequest): Promise<MarketAnalysisResponse> =>
    api.post('/market/analyze', data).then((res) => res.data),
}
