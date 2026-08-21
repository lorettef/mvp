import type { PnLResponse } from '@/types/api'
import { api } from './client'

export const pnlApi = {
  get: (id: string): Promise<PnLResponse> =>
    api.get(`/companies/${id}/pnl`).then((res) => res.data),
}
