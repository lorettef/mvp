import type { PlanResponse } from '@/types/api'
import { api } from './client'

export const subscriptionApi = {
  plans: ({ signal }: { signal?: AbortSignal } = {}): Promise<PlanResponse[]> => api.get('/subscription/plans', { signal }).then((res) => res.data),
}
