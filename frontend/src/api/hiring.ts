import type {
  HiringPlanResponse,
  HiringSettingsResponse,
  HiringSettingsUpsert,
} from '@/types/api'
import { api } from './client'

export const hiringApi = {
  plan: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<HiringPlanResponse> =>
    api.get(`/companies/${id}/hiring`, { signal }).then((res) => res.data),
  settings: (id: string, { signal }: { signal?: AbortSignal } = {}): Promise<HiringSettingsResponse> =>
    api.get(`/companies/${id}/hiring/settings`, { signal }).then((res) => res.data),
  upsertSettings: (
    id: string,
    data: HiringSettingsUpsert,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<HiringSettingsResponse> =>
    api.put(`/companies/${id}/hiring/settings`, data, { signal }).then((res) => res.data),
}
