import { api } from './client'

export const analytics = {
  track: (event: string, properties?: Record<string, unknown>, { signal }: { signal?: AbortSignal } = {}): void => {
    api.post('/analytics/track', { event, properties }, { signal }).catch(() => {
      // аналитика не должна ломать UX
    })
  },
}
