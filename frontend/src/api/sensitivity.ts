import type { SensitivityResponse } from '@/types/api'
import { api } from './client'

export const sensitivityApi = {
  get: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<SensitivityResponse> =>
    api.get(`/companies/${id}/sensitivity`, { signal }).then((res) => res.data),
}
