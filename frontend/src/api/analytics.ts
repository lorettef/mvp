import { api } from './client'

export const analytics = {
  track: (event: string, properties?: Record<string, unknown>): void => {
    api.post('/analytics/track', { event, properties }).catch(() => {
      // аналитика не должна ломать UX
    })
  },
}
