import type { CreditForecastResponse } from '@/types/api'
import { api } from './client'

export const creditApi = {
  forecast: (id: string): Promise<CreditForecastResponse> =>
    api.get(`/companies/${id}/credit-forecast`).then((res) => res.data),
}
