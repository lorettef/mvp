import type { PlanResponse } from '@/types/api'
import { api } from './client'

export const subscriptionApi = {
  plans: (): Promise<PlanResponse[]> => api.get('/subscription/plans').then((res) => res.data),
}
