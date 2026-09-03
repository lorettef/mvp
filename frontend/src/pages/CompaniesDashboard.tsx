import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from '../api/companies'
import { getTenantKey } from '../auth/authSession'
import { qk } from '../lib/queryKeys'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { QueryState } from '@/components/common/QueryState'
import { StartupInvite } from '@/components/common/StartupInvite'
import { CompanyOnboardingWizard } from '@/components/company/CompanyOnboardingWizard'
import { CompanyLifecycleSections } from '@/components/company/CompanyLifecycleSections'
import { fmtRub } from '@/lib/format'
import { Building2, TrendingUp, CircleCheck, AlertTriangle, Plus, RefreshCw } from 'lucide-react'

export const CompaniesDashboard = () => {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)

  const tenantKey = getTenantKey()

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: qk.dashboard(tenantKey),
    queryFn: ({ signal }) => dashboardApi.get({ signal }),
  })

  const total = data?.totalCompanies ?? 0
  const onTrack = data?.onTrack ?? 0
  const behind = data?.behind ?? 0
  const onTrackPct = total > 0 ? Math.round((onTrack / total) * 100) : 0

  const cards = [
    { title: t('dashboard.cards.companies'), value: String(total), icon: Building2 },
    { title: t('dashboard.cards.avgRevenue'), value: fmtRub(data?.avgRevenue ?? null), icon: TrendingUp },
    { title: t('dashboard.cards.onTrack'), value: `${onTrackPct}%`, icon: CircleCheck },
    { title: t('dashboard.cards.behind'), value: String(behind), icon: AlertTriangle },
  ]

  return (
    <QueryState
      isLoading={isLoading}
      isError={Boolean(error)}
      error={error}
      onRetry={() => refetch()}
    >
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('dashboard.title')}</h1>
          <p className="text-muted-foreground">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            {isFetching ? t('common.recalculating') : t('common.forceRecalc')}
          </Button>
          <Button size="sm" onClick={() => setShowForm((open) => !open)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('dashboard.addCompany')}
          </Button>
        </div>
      </div>

      <StartupInvite />

      <CompanyOnboardingWizard open={showForm} tenantKey={tenantKey} onClose={() => setShowForm(false)} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.title} className="border bg-card/50">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{c.title}</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{c.value}</p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 text-primary">
                  <c.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CompanyLifecycleSections tenantKey={tenantKey} dashboardCompanies={data?.companies ?? []} />
    </div>
    </QueryState>
  )
}
