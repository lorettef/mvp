import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { analytics } from '../../api/analytics'
import { AppHeader } from '@/components/common/AppHeader'
import { CompanyContextBar } from '@/components/common/CompanyContextBar'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export const Layout = () => {
  const { pathname } = useLocation()
  const user = useAuthStore((state) => state.user)
  const compactDashboard = pathname === '/dashboard' && user?.role === 'admin' && user.organizationType !== 'startup'
  useEffect(() => {
    analytics.track('session_started')
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <CompanyContextBar />
      <main className={cn('flex-1 p-4', !compactDashboard && 'sm:p-6')}>
        <Outlet />
      </main>
    </div>
  )
}
