import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from '../api/companies'
import { getTenantKey } from '../auth/authSession'
import { qk } from '../lib/queryKeys'
import { Button } from '@/components/ui/button'
import { QueryState } from '@/components/common/QueryState'
import { StartupInvite } from '@/components/common/StartupInvite'
import { CompanyOnboardingWizard } from '@/components/company/CompanyOnboardingWizard'
import { CompanyLifecycleSections } from '@/components/company/CompanyLifecycleSections'
import { PageHeader } from '@/components/shared/page-header'
import { MetricCard } from '@/components/shared/metric-card'
import { fmtRub } from '@/lib/format'
import { Building2, TrendingUp, CircleCheck, AlertTriangle, Plus, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

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

  return (
    <QueryState
      isLoading={isLoading}
      isError={Boolean(error)}
      error={error}
      onRetry={() => refetch()}
    >
      <div className="space-y-6">
        <PageHeader
          title={t('dashboard.title')}
          description={t('dashboard.subtitle')}
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
                {isFetching ? t('common.recalculating') : t('common.forceRecalc')}
              </Button>
              <Button size="sm" onClick={() => setShowForm((open) => !open)}>
                <Plus className="h-4 w-4" />
                {t('dashboard.addCompany')}
              </Button>
            </>
          }
        />

        <StartupInvite />

        <CompanyOnboardingWizard
          open={showForm}
          tenantKey={tenantKey}
          onClose={() => setShowForm(false)}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={t('dashboard.cards.companies')}
            value={String(total)}
            icon={<Building2 className="h-4 w-4" />}
          />
          <MetricCard
            label={t('dashboard.cards.avgRevenue')}
            value={fmtRub(data?.avgRevenue ?? null)}
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard
            label={t('dashboard.cards.onTrack')}
            value={`${onTrackPct}%`}
            icon={<CircleCheck className="h-4 w-4" />}
          />
          <MetricCard
            label={t('dashboard.cards.behind')}
            value={String(behind)}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
        </div>

        <CompanyLifecycleSections
          tenantKey={tenantKey}
          dashboardCompanies={data?.companies ?? []}
        />
      </div>
    </QueryState>
  )
}
