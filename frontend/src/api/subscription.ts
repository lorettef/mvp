import type { SubscriptionStatus } from '@/types/api'
import { api } from './client'

export const subscriptionApi = {
  status: (): Promise<SubscriptionStatus> => api.get('/subscription/status').then((res) => res.data),
  update: (plan: string): Promise<SubscriptionStatus> => api.post(`/subscription/update?plan=${plan}`).then((res) => res.data),
}
