import type { CashFlowResponse } from '@/types/api'
import { api } from './client'

export const cashflowApi = {
  get: (id: string): Promise<CashFlowResponse> =>
    api.get(`/companies/${id}/cashflow`).then((res) => res.data),
}
