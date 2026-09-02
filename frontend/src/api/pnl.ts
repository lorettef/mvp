import type { PnLResponse } from '@/types/api'
import { api } from './client'

export const pnlApi = {
  get: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<PnLResponse> =>
    api.get(`/companies/${id}/pnl`, { signal }).then((res) => res.data),
}
