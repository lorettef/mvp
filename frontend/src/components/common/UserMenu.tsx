import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, Moon, Settings, Sun, Languages } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { logout } from '@/auth/authSession'
import { switchLanguage } from '@/i18n'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full"
          aria-label={t('nav.account')}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {user?.fullName?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium text-foreground">{user?.fullName || t('nav.user')}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/settings">
            <Settings />
            {t('nav.settings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => switchLanguage(i18n.language === 'ru' ? 'en' : 'ru')}
        >
          <Languages />
          {t('common.language')}: {i18n.language === 'ru' ? 'EN' : 'RU'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
        >
          {theme === 'light' ? <Moon /> : <Sun />}
          {t('nav.theme')}: {theme === 'light' ? t('nav.themeLight') : t('nav.themeDark')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive [&_svg]:text-destructive"
        >
          <LogOut />
          {t('common.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
