import type { FinancingCreate, FinancingResponse, FinancingUpdate } from '@/types/api'
import { api } from './client'

export const financingApi = {
  list: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<FinancingResponse[]> =>
    api.get(`/companies/${id}/financing`, { signal }).then((res) => res.data),
  create: (id: string, data: FinancingCreate): Promise<FinancingResponse> =>
    api.post(`/companies/${id}/financing`, data).then((res) => res.data),
  update: (id: string, financingId: string, data: FinancingUpdate): Promise<FinancingResponse> =>
    api.patch(`/companies/${id}/financing/${financingId}`, data).then((res) => res.data),
  remove: (id: string, financingId: string): Promise<{ detail: string }> =>
    api.delete(`/companies/${id}/financing/${financingId}`).then((res) => res.data),
}
