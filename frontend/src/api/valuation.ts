import type { ValuationResponse } from '@/types/api'
import { api } from './client'

export const valuationApi = {
  get: (id: string): Promise<ValuationResponse> =>
    api.get(`/companies/${id}/valuation`).then((res) => res.data),
}
