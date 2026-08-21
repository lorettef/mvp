import type {
  HiringPlanResponse,
  HiringSettingsResponse,
  HiringSettingsUpsert,
} from '@/types/api'
import { api } from './client'

export const hiringApi = {
  plan: (id: string): Promise<HiringPlanResponse> =>
    api.get(`/companies/${id}/hiring`).then((res) => res.data),
  settings: (id: string): Promise<HiringSettingsResponse> =>
    api.get(`/companies/${id}/hiring/settings`).then((res) => res.data),
  upsertSettings: (
    id: string,
    data: HiringSettingsUpsert,
  ): Promise<HiringSettingsResponse> =>
    api.put(`/companies/${id}/hiring/settings`, data).then((res) => res.data),
}
