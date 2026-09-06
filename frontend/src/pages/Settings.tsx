import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { logout } from '../auth/authSession'
import { User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const Settings = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">{t('settings.title')}</h1>

      {/* Профиль */}
      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('settings.profile')}
          </h3>
          <div className="space-y-2 text-muted-foreground">
            <p><span className="text-sm text-muted-foreground">{t('settings.email')}</span> {user?.email}</p>
            <p><span className="text-sm text-muted-foreground">{t('settings.company')}</span> {user?.companyName || t('settings.notSpecified')}</p>
            <p><span className="text-sm text-muted-foreground">{t('settings.name')}</span> {user?.fullName || t('settings.notSpecifiedM')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Выход */}
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={logout}
      >
        <LogOut />
        {t('common.logout')}
      </Button>
    </div>
  )
}
