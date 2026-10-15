import { PortfolioAIInsight } from '@/components/dashboard/PortfolioAIInsight'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dashboardApi } from '@/api/companies'
import { getTenantKey } from '@/auth/authSession'
import { qk } from '@/lib/queryKeys'
import type { CatalogResponse } from '@/types/api'
import { PageHeader } from '@/components/shared/page-header'
import { QueryState } from '@/components/common/QueryState'
import { PortfolioKpiStrip } from '@/components/dashboard/PortfolioKpiStrip'
import { PortfolioChartSlot } from '@/components/dashboard/PortfolioChartSlot'

export function PortfolioHome() {
  const { t } = useTranslation()
  const tenantKey = getTenantKey()
  const queryClient = useQueryClient()
  const dashboardQuery = useQuery({
    queryKey: qk.dashboard(tenantKey),
    queryFn: ({ signal }) => dashboardApi.get({ signal }),
  })
  const performanceQuery = useQuery({
    queryKey: qk.dashboardPerformance(tenantKey, 6),
    queryFn: ({ signal }) => dashboardApi.performance(6, { signal }),
  })
  // Reuse catalog labels if already available; Home only requests its two
  // portfolio sources and retains the existing unknown-slug fallback.
  const catalog = queryClient.getQueryData<CatalogResponse>(['catalog'])
  const industryLabel = (slug: string) => catalog?.industries.find((item) => item.slug === slug)?.label ?? slug
  const dashboard = {
    data: dashboardQuery.data, isLoading: dashboardQuery.isLoading, isError: dashboardQuery.isError,
    error: dashboardQuery.error, onRetry: () => { void dashboardQuery.refetch() },
  }
  const performance = {
    data: performanceQuery.data, isLoading: performanceQuery.isLoading, isError: performanceQuery.isError,
    error: performanceQuery.error, onRetry: () => { void performanceQuery.refetch() },
  }

  return <div className="min-w-0 space-y-4">
    <PageHeader title={t('nav.home')} />
    <QueryState isLoading={dashboard.isLoading} isError={dashboard.isError} error={dashboard.error} onRetry={dashboard.onRetry}>
      <PortfolioKpiStrip data={dashboard.data} />
    </QueryState>
    <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <PortfolioChartSlot number={1} defaultVariant="revenue" dashboard={dashboard} performance={performance} industryLabel={industryLabel} />
      <PortfolioChartSlot number={2} defaultVariant="share" dashboard={dashboard} performance={performance} industryLabel={industryLabel} />
    </div>
    <PortfolioAIInsight />
  </div>
}
