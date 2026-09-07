import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { analytics } from '../../api/analytics'
import { AppHeader } from '@/components/common/AppHeader'
import { CompanyContextBar } from '@/components/common/CompanyContextBar'

export const Layout = () => {
  useEffect(() => {
    analytics.track('session_started')
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader />
      <CompanyContextBar />
      <main className="flex-1 p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}
