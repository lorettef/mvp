import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  fullName: string
  companyName: string
  subscriptionPlan: string
  dailyLimit: number
  usedToday: number
}

interface AuthState {
  user: User | null
  setUser: (user: AuthState['user']) => void
  logout: () => void
  updateSubscription: (plan: string, limit: number) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
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
