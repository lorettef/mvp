import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '../api/auth'

export interface User {
  id: string
  email: string
  fullName: string
  companyName: string
  role: string
  organizationId: string | null
  companyId: string | null
  subscriptionPlan: string
  dailyLimit: number
  usedToday: number
}

interface AuthState {
  user: User | null
  setUser: (user: AuthState['user']) => void
  logout: () => Promise<void>
  updateSubscription: (plan: string, limit: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: async () => {
        try {
          await authApi.logout()
        } catch {
          // сеть/API недоступны — всё равно чистим локальный стейт
        }
        set({ user: null })
      },
      updateSubscription: (plan, limit) =>
        set((state) => ({
          user: state.user ? { ...state.user, subscriptionPlan: plan, dailyLimit: limit } : null,
        })),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
