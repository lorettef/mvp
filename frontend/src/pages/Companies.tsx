import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { canViewPortfolio } from '@/lib/navigation'
import { CompaniesDashboard } from './CompaniesDashboard'

export function Companies() {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (!canViewPortfolio(user)) return <Navigate to="/dashboard" replace />
  return <CompaniesDashboard />
}
