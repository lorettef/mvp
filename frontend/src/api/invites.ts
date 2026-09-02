import type { InviteInfo, InviteResponse } from '@/types/api'
import { api } from './client'

export const invitesApi = {
  create: (email?: string | null, { signal }: { signal?: AbortSignal } = {}): Promise<InviteResponse> =>
    api.post('/invites', { email }, { signal }).then((res) => res.data),
  get: (token: string, { signal }: { signal?: AbortSignal } = {}): Promise<InviteInfo> =>
    api.get(`/invites/${token}`, { signal }).then((res) => res.data),
}
