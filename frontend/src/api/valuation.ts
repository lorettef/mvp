import type { ValuationResponse } from '@/types/api'
import { api } from './client'

export const valuationApi = {
  get: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<ValuationResponse> =>
    api.get(`/companies/${id}/valuation`, { signal }).then((res) => res.data),
}
