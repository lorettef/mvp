import type { SensitivityResponse } from '@/types/api'
import { api } from './client'

export const sensitivityApi = {
  get: (id: string): Promise<SensitivityResponse> =>
    api.get(`/companies/${id}/sensitivity`).then((res) => res.data),
}
