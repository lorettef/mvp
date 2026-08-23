import React, { useEffect, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { analytics } from '../../api/analytics'
import {
  LayoutDashboard,
  Sparkles,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

export const Layout = () => {
  const { user, logout } = useAuthStore()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    analytics.track('session_started')
  }, [])

  const navigation = [
    { name: 'Дашборд', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Рекомендации', href: '/recommendations', icon: Sparkles },
    { name: 'Прогноз', href: '/forecast', icon: TrendingUp },
    { name: 'Настройки', href: '/settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-background flex">
      {/* Боковая панель */}
      <aside className="w-64 bg-background border-r border hidden md:flex flex-col fixed h-full shadow-sm z-10">
        <div className="p-5 border-b border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z"
                  stroke="currentColor" strokeWidth="2.5" fill="none"/>
                <path d="M18 22l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Startup Engine</h1>
              <p className="text-xs text-muted-foreground">{user?.companyName || 'Моя компания'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Button
                key={item.name}
                variant="ghost"
                className={`w-full justify-start gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
                asChild
              >
                <Link to={item.href}>
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </Button>
            )
          })}
        </nav>

        <div className="p-4 border-t border">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-slate-300 font-bold text-sm shadow-sm">
              {user?.fullName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground/80 truncate">
                {user?.fullName || 'Пользователь'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-muted-foreground hover:text-destructive"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Выйти
          </Button>
        </div>
      </aside>

      {/* Основной контент */}
      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border px-6 py-4 flex items-center justify-between">
          <button 
  className="md:hidden p-2 hover:bg-accent rounded-xl"
  onClick={() => setMobileOpen(!mobileOpen)}
  aria-label="Toggle menu"
  aria-expanded={mobileOpen}
>
  <Menu className="w-5 h-5" />
</button>
{mobileOpen && (
  <div className="md:hidden absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-20">
    <nav className="p-4 space-y-1">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  </div>
)}
          <div className="flex items-center gap-3 ml-auto">
            {user?.subscriptionPlan === 'starter' && (
              <Badge variant="secondary">Starter</Badge>
            )}
            {user?.subscriptionPlan === 'pro' && (
              <Badge variant="default">Pro</Badge>
            )}
            {user?.subscriptionPlan === 'business' && (
              <Badge variant="outline" className="bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border-amber-200">Business</Badge>
            )}
            {user?.subscriptionPlan === 'enterprise' && (
              <Badge variant="outline" className="bg-gradient-to-r from-purple-50 to-blue-50 text-purple-700 border-purple-200">Enterprise</Badge>
            )}
            <ThemeToggle />
          </div>
        </header>

        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
