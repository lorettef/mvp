import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Menu, Moon, Sun, Languages } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { logout } from '@/auth/authSession'
import { switchLanguage } from '@/i18n'
import { useTheme } from '@/components/theme-provider'
import { globalNav } from '@/lib/navigation'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/common/UserMenu'
import { BrandMark, Logo } from '@/components/shared/logo'
import { cn } from '@/lib/utils'

export function AppHeader() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) => location.pathname === href

  const linkClass = (active: boolean) =>
    cn(
      'rounded-md px-3 py-2 text-sm font-medium transition-colors',
      active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
    )

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-6">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <BrandMark className="h-7 w-7 rounded-md" />
          <span className="truncate text-sm font-semibold">Startup Investment Bridge</span>
        </Link>

        <nav aria-label={t('nav.globalLabel')} className="hidden items-center gap-1 md:flex">
          {globalNav.map((item) => (
            <Link
              key={item.key}
              to={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={linkClass(isActive(item.href))}
            >
              {t(item.labelKey)}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <div className="hidden md:block">
          <UserMenu />
        </div>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('common.toggleMenu')}>
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetTitle className="sr-only">{t('nav.dashboard')}</SheetTitle>
            <div className="flex h-full flex-col">
              <div className="px-5 py-5">
                <Logo subtitle={user?.companyName || t('nav.myCompany')} />
              </div>

              <nav aria-label={t('nav.globalLabel')} className="flex-1 space-y-1 px-3 py-2">
                {globalNav.map((item) => (
                  <Link
                    key={item.key}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={isActive(item.href) ? 'page' : undefined}
                    className={cn('block', linkClass(isActive(item.href)))}
                  >
                    {t(item.labelKey)}
                  </Link>
                ))}
              </nav>

              <div className="space-y-1 border-t p-3">
                <button
                  type="button"
                  onClick={() => switchLanguage(i18n.language === 'ru' ? 'en' : 'ru')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                >
                  <Languages className="h-4 w-4" />
                  {t('common.language')}: {i18n.language === 'ru' ? 'EN' : 'RU'}
                </button>
                <button
                  type="button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                >
                  {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {t('nav.theme')}: {theme === 'light' ? t('nav.themeLight') : t('nav.themeDark')}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  {t('common.logout')}
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
