import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../store/authStore'
import { logout } from '../auth/authSession'
import { subscriptionApi } from '../api/subscription'
import type { PlanResponse } from '@/types/api'
import { User, CreditCard, LogOut, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Settings = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [plans, setPlans] = useState<PlanResponse[]>([])
  const [plansLoading, setPlansLoading] = useState(true)

  const fmtPrice = (v: number | null) =>
    v == null ? t('settings.individual') : v === 0 ? t('settings.free') : t('settings.perMonth', { price: v.toLocaleString('ru-RU') })

  const fmtAiLimit = (v: number | null) =>
    v == null ? t('settings.unlimitedAi') : t('settings.aiReports', { count: v })

  useEffect(() => {
    subscriptionApi
      .plans()
      .then(setPlans)
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false))
  }, [])

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

      {/* Подписка */}
      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            {t('settings.subscription')}
          </h3>

          {plansLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('settings.loadingPlans')}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {plans.map((plan) => (
                <Card
                  key={plan.id}
                  className={`transition-all duration-200 ${
                    user?.subscriptionPlan === plan.id
                      ? 'border-primary bg-primary/5'
                      : 'border-input bg-card/50'
                  }`}
                >
                  <CardContent className="p-5">
                    <p className="font-semibold text-foreground">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">{fmtAiLimit(plan.aiReportsLimit)}</p>
                    <p className="text-sm font-bold text-foreground mt-1">{fmtPrice(plan.price)}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {t('settings.companiesUpTo', { count: plan.companyLimit ?? '∞' })}
                    </p>
                    {user?.subscriptionPlan === plan.id ? (
                      <Badge variant="default" className="mt-2">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {t('settings.active')}
                      </Badge>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {user && (
            <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg mt-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  {t('settings.usedToday', { used: user.usedToday, limit: user.dailyLimit ?? '∞' })}
                </p>
              </div>
              {user.dailyLimit != null && (
                <div className="w-full max-w-xs bg-muted h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((user.usedToday / user.dailyLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          )}
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
