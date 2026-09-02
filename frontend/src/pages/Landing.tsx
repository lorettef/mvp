import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, LogOut } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { logout } from '../auth/authSession'
import { Button } from '@/components/ui/button'
import { LanguageToggle } from '@/components/LanguageToggle'

export const Landing = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const isLoggedIn = Boolean(user)

  const handlePrimary = () => {
    if (isLoggedIn) {
      navigate('/dashboard')
    } else {
      navigate('/register')
    }
  }

  return (
    <div className="relative min-h-screen flex flex-col overflow-hidden bg-slate-950">
      {/* Фоновое видео + затемняющий оверлей */}
      <div className="absolute inset-0" aria-hidden>
        <video
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover opacity-50"
          src="/video/hero.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-slate-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* Верхняя панель */}
      <header className="relative z-10 w-full">
        <div className="mx-auto max-w-6xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-500/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z"
                  stroke="currentColor" strokeWidth="2.5" fill="none" />
                <path d="M18 22l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-semibold text-white">Startup Engine</span>
          </div>

          <div className="flex items-center gap-3">
            <LanguageToggle className="text-white/70 hover:text-white" />
            {isLoggedIn ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-white/80 hover:text-white hover:bg-white/10"
                onClick={logout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('landing.logout')}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-white/80 hover:text-white hover:bg-white/10" asChild>
                <Link to="/login">{t('landing.login')}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Основной контент */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-6">
        <div className="max-w-3xl text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/30">
              <svg className="w-9 h-9 text-white" viewBox="0 0 48 48" fill="none">
                <path d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z"
                  stroke="currentColor" strokeWidth="2.5" fill="none" />
                <path d="M18 22l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <span className="inline-block px-4 py-1.5 rounded-full border border-white/15 bg-white/5 text-sm text-primary-200 mb-6">
            {t('landing.badge')}
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            {t('landing.title')}
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-300/90 leading-relaxed">
            {t('landing.subtitle')}
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="w-full sm:w-auto px-8" onClick={handlePrimary}>
              {isLoggedIn ? t('landing.goDashboard') : t('landing.start')}
              <ArrowRight className="w-4 h-4" />
            </Button>
            {!isLoggedIn && (
              <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" asChild>
                <Link to="/login">{t('landing.login')}</Link>
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Нижняя строка с ключевыми возможностями */}
      <footer className="relative z-10 w-full border-t border-white/10">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-slate-400">
          <span>{t('landing.footerUnit')}</span>
          <span className="hidden sm:inline text-white/20">·</span>
          <span>{t('landing.footerCohorts')}</span>
          <span className="hidden sm:inline text-white/20">·</span>
          <span>{t('landing.footerReadiness')}</span>
        </div>
      </footer>
    </div>
  )
}
