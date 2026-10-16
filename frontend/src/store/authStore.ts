import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ProductRole = 'fund' | 'startup' | 'investor'

export interface User {
  id: string
  email: string
  fullName: string
  companyName: string
  role: string
  productRole?: ProductRole | null
  organizationId: string | null
  companyId: string | null
  subscriptionPlan: string
  dailyLimit: number | null
  usedToday: number
  organizationType?: string | null
}

interface AuthState {
  user: User | null
  sessionReady: boolean
  setSessionPending: () => void
  setUser: (user: AuthState['user']) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionReady: false,
      setSessionPending: () => set({ sessionReady: false }),
      setUser: (user) => set({ user, sessionReady: true }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
