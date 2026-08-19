import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { CompaniesDashboard } from './CompaniesDashboard'

export const Dashboard = () => {
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'admin') {
    return <CompaniesDashboard />
  }

  if (user.companyId) {
    return <Navigate to={`/companies/${user.companyId}`} replace />
  }

  return <Navigate to="/login" replace />
}
