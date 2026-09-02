import type { CashFlowResponse } from '@/types/api'
import { api } from './client'

export const cashflowApi = {
  get: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<CashFlowResponse> =>
    api.get(`/companies/${id}/cashflow`, { signal }).then((res) => res.data),
}
