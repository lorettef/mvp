import type { CreditForecastResponse } from '@/types/api'
import { api } from './client'

export const creditApi = {
  forecast: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<CreditForecastResponse> =>
    api.get(`/companies/${id}/credit-forecast`, { signal }).then((res) => res.data),
}
