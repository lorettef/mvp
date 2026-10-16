import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'

export const ProtectedRoute = () => {
  const { user, sessionReady } = useAuthStore()
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (sessionReady === false) return null

  return <Outlet />
}
