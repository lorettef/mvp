import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { User } from 'lucide-react'
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
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('settings.profile')}
          </h2>
          <div className="space-y-2 text-muted-foreground">
            <p><span className="text-sm text-muted-foreground">{t('settings.email')}</span> {user?.email}</p>
            <p><span className="text-sm text-muted-foreground">{t('settings.company')}</span> {user?.companyName || t('settings.notSpecified')}</p>
            <p><span className="text-sm text-muted-foreground">{t('settings.name')}</span> {user?.fullName || t('settings.notSpecifiedM')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
