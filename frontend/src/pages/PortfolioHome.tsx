import { PortfolioAIInsight } from '@/components/dashboard/PortfolioAIInsight'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { dashboardApi, companiesApi } from '@/api/companies'
import { catalogApi } from '@/api/catalog'
import { getTenantKey } from '@/auth/authSession'
import { qk } from '@/lib/queryKeys'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { usePermissions } from '@/hooks/usePermissions'
import { PageHeader } from '@/components/shared/page-header'
import { QueryState } from '@/components/common/QueryState'
import { PortfolioKpiStrip } from '@/components/dashboard/PortfolioKpiStrip'
import { PortfolioChartSlot } from '@/components/dashboard/PortfolioChartSlot'
import { DashboardPortfolioTable } from '@/components/dashboard/DashboardPortfolioTable'
import { FilterDrawer } from '@/components/dashboard/FilterDrawer'

export function PortfolioHome() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const permissions = usePermissions()
  const tenantKey = getTenantKey()
  const filterState = useDashboardFilters()
  const filters = filterState.appliedFilters
  const dashboardQuery = useQuery({
    queryKey: qk.dashboard(tenantKey, filters),
    queryFn: ({ signal }) => dashboardApi.get({ signal, filters }),
  })
  const performanceQuery = useQuery({
    queryKey: qk.dashboardPerformance(tenantKey, 6, filters),
    queryFn: ({ signal }) => dashboardApi.performance(6, { signal, filters }),
  })
  const companiesQuery = useQuery({
    queryKey: qk.companies(tenantKey, false),
    queryFn: ({ signal }) => companiesApi.list({ signal, archived: false }),
  })
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
  })
  const industryLabel = (slug: string | null) => slug
    ? catalogQuery.data?.industries.find((item) => item.slug === slug)?.label ?? slug : '—'
  const dashboard = {
    data: dashboardQuery.data, isLoading: dashboardQuery.isLoading, isError: dashboardQuery.isError,
    error: dashboardQuery.error, onRetry: () => { void dashboardQuery.refetch() },
  }
  const performance = {
    data: performanceQuery.data, isLoading: performanceQuery.isLoading, isError: performanceQuery.isError,
    error: performanceQuery.error, onRetry: () => { void performanceQuery.refetch() },
  }
  const panelProps = {
    filters: filterState.filters,
    onChange: filterState.updateFilters,
    onReset: filterState.resetFilters,
    invalidRange: filterState.invalidRange,
    activeGroups: filterState.activeGroups,
    canReset: filterState.canReset,
    companies: {
      options: (companiesQuery.data ?? []).map(company => ({ value: company.id, label: company.name })),
      isLoading: companiesQuery.isLoading, isError: companiesQuery.isError,
      onRetry: () => { void companiesQuery.refetch() },
    },
    industries: {
      options: (catalogQuery.data?.industries ?? []).map(industry => ({ value: industry.slug, label: industry.label })),
      isLoading: catalogQuery.isLoading, isError: catalogQuery.isError,
      onRetry: () => { void catalogQuery.refetch() },
    },
  }

  return <div className="min-w-0 space-y-4">
    <PageHeader title={t('nav.home')} />
    <QueryState isLoading={dashboard.isLoading} isError={dashboard.isError} error={dashboard.error} onRetry={dashboard.onRetry}>
      <PortfolioKpiStrip data={dashboard.data} />
    </QueryState>
    <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
      <PortfolioChartSlot number={1} defaultVariant="revenue" dashboard={dashboard} performance={performance} industryLabel={slug => industryLabel(slug)} />
      <PortfolioChartSlot number={2} defaultVariant="share" dashboard={dashboard} performance={performance} industryLabel={slug => industryLabel(slug)} />
    </div>
    <section className="min-w-0 space-y-3" aria-label={t('dashboard.portfolioTable.title')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t('dashboard.portfolioTable.title')}</h2>
        <FilterDrawer active={filterState.activeGroups > 0} panelProps={panelProps} />
      </div>
      <QueryState isLoading={dashboard.isLoading} isError={dashboard.isError} error={dashboard.error} onRetry={dashboard.onRetry}>
        <DashboardPortfolioTable companies={dashboard.data?.companies ?? []} industryLabel={industryLabel} filtered={filterState.activeGroups > 0}
          onOpen={permissions.canManagePortfolio ? id => navigate(`/companies/${id}`) : undefined} />
      </QueryState>
    </section>
    <PortfolioAIInsight filters={filters} />
  </div>
}
