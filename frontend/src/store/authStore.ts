import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  fullName: string
  companyName: string
  role: string
  organizationId: string | null
  companyId: string | null
  subscriptionPlan: string
  dailyLimit: number | null
  usedToday: number
}

interface AuthState {
  user: User | null
  setUser: (user: AuthState['user']) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
