import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dashboardApi, companiesApi } from '../api/companies'
import { catalogApi } from '../api/catalog'
import { getTenantKey } from '../auth/authSession'
import { qk } from '../lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { QueryState } from '@/components/common/QueryState'
import { StartupInvite } from '@/components/common/StartupInvite'
import { PageHeader } from '@/components/shared/page-header'
import { Section } from '@/components/shared/section'
import { MetricCard } from '@/components/shared/metric-card'
import { FundCompaniesTable } from '@/components/dashboard/FundCompaniesTable'
import { CompanyRevenueComparisonChart } from '@/components/dashboard/CompanyRevenueComparisonChart'
import { CompanyRevenueShareChart } from '@/components/dashboard/CompanyRevenueShareChart'
import { IndustryProfitabilityChart } from '@/components/dashboard/IndustryProfitabilityChart'
import { PortfolioRevenueChart } from '@/components/dashboard/PortfolioRevenueChart'
import { DashboardFiltersPanel } from '@/components/dashboard/DashboardFiltersPanel'
import { PortfolioPlanFactTable, PortfolioUnitEconomicsTable } from '@/components/dashboard/PortfolioSummaryTables'
import { useDashboardFilters } from '@/hooks/useDashboardFilters'
import { fmtRub, fmtSignedPct } from '@/lib/format'
import { dashboardAttentionLabel } from '@/lib/dashboardAttention'
import { Building2, TrendingUp, CircleCheck, AlertTriangle, CalendarClock, RotateCcw, Trash2, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'

type Range = 3 | 6 | 12
type Mode = 'both' | 'fact' | 'plan'

export const CompaniesDashboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Range>(6)
  const [mode, setMode] = useState<Mode>('both')
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const filterState = useDashboardFilters()
  const filters = filterState.appliedFilters

  const tenantKey = getTenantKey()

  const dashboardQuery = useQuery({
    queryKey: qk.dashboard(tenantKey, filters),
    queryFn: ({ signal }) => dashboardApi.get({ signal, filters }),
    // Retain the table/KPI while filters load, but never reuse another tenant's data.
    placeholderData: (previousData, previousQuery) => previousQuery?.queryKey[1] === tenantKey ? previousData : undefined,
  })
  const { data, isLoading, error, refetch } = dashboardQuery

  const performanceQuery = useQuery({
    queryKey: qk.dashboardPerformance(tenantKey, range, filters),
    queryFn: ({ signal }) => dashboardApi.performance(range, { signal, filters }),
    placeholderData: (previousData, previousQuery) => previousQuery?.queryKey[1] === tenantKey ? previousData : undefined,
  })

  // Options are independent of the filtered snapshots, and share the existing
  // lifecycle invalidation key so archive/restore refreshes available companies.
  const activeCompaniesQuery = useQuery({
    queryKey: qk.companies(tenantKey, false),
    queryFn: ({ signal }) => companiesApi.list({ signal, archived: false }),
  })

  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
  })

  const archivedQuery = useQuery({
    queryKey: qk.companies(tenantKey, true),
    queryFn: ({ signal }) => companiesApi.list({ signal, archived: true }),
  })

  const invalidateViews = (companyId: string) => {
    void queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
    void queryClient.invalidateQueries({ queryKey: qk.companies(tenantKey, false) })
    void queryClient.invalidateQueries({ queryKey: qk.companies(tenantKey, true) })
    void queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, companyId) })
  }

  const archiveMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.archive(companyId),
    onSuccess: (_, companyId) => invalidateViews(companyId),
  })
  const restoreMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.restore(companyId),
    onSuccess: (_, companyId) => invalidateViews(companyId),
  })
  const deleteMutation = useMutation({
    mutationFn: (companyId: string) => companiesApi.remove(companyId),
    onSuccess: (_, companyId) => invalidateViews(companyId),
  })

  const total = data?.totalCompanies ?? 0
  const onTrack = data?.onTrack ?? 0
  const behind = data?.behind ?? 0
  // «Выполняют план» — доля компаний С планом, которые его выполняют. Компании
  // без плана (no_plan) и без данных (no_data) не входят в знаменатель, иначе
  // пустой портфель показывал бы вводящие в заблуждение «0%».
  const planCompanies = onTrack + behind
  const onTrackPct = planCompanies > 0 ? Math.round((onTrack / planCompanies) * 100) : null

  const industryLabels = new Map((catalogQuery.data?.industries ?? []).map((i) => [i.slug, i.label]))
  const industryLabel = (slug: string | null) => (slug ? (industryLabels.get(slug) ?? slug) : '—')

  const companies = data?.companies ?? []
  const attentionCompanies = companies.filter((c) => c.attention.length > 0)
  const archivedCompanies = archivedQuery.data ?? []

  const openCompany = (id: string) => navigate(`/companies/${id}`)
  const aiAnalysis = (id: string) => navigate(`/companies/${id}?tab=unit`)

  const isArchiveMutating = archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending
  const updating = dashboardQuery.isFetching || performanceQuery.isFetching
  const filtersLabel = `${t('dashboard.filters.title')}${filterState.activeGroups ? ` · ${filterState.activeGroups}` : ''}`
  const panelProps = {
    filters: filterState.filters,
    onChange: filterState.updateFilters,
    onReset: filterState.resetFilters,
    invalidRange: filterState.invalidRange,
    activeGroups: filterState.activeGroups,
    canReset: filterState.canReset,
    companies: {
      options: (activeCompaniesQuery.data ?? []).map(company => ({ value: company.id, label: company.name })),
      isLoading: activeCompaniesQuery.isLoading, isError: activeCompaniesQuery.isError,
      onRetry: () => { void activeCompaniesQuery.refetch() },
    },
    industries: {
      options: (catalogQuery.data?.industries ?? []).map(industry => ({ value: industry.slug, label: industry.label })),
      isLoading: catalogQuery.isLoading, isError: catalogQuery.isError,
      onRetry: () => { void catalogQuery.refetch() },
    },
  }

  return (
    <div className={cn('grid min-w-0 items-start gap-4', sidebarExpanded && 'lg:grid-cols-[14rem_minmax(0,1fr)]')}>
      {sidebarExpanded && (
        <aside aria-label={t('dashboard.filters.title')} className="hidden min-w-0 rounded-lg border bg-card p-4 lg:block">
          <DashboardFiltersPanel {...panelProps} onCollapse={() => setSidebarExpanded(false)} />
        </aside>
      )}
      <div className="min-w-0 space-y-4">
        <PageHeader
          title={t('dashboard.title')}
          actions={<>
            {!sidebarExpanded && (
              <Button variant="outline" size="sm" className="hidden gap-2 lg:inline-flex" aria-label={t('dashboard.filters.show')} onClick={() => setSidebarExpanded(true)}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{filtersLabel}
              </Button>
            )}
            <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 lg:hidden"> <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{filtersLabel}</Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 max-w-[calc(100vw-2rem)] overflow-y-auto bg-card p-4" closeLabel={t('dashboard.filters.close')}
                onEscapeKeyDown={event => {
                  // Escape in a nested selection closes that menu first.
                  if (event.target instanceof Element && event.target.closest('[role="menu"]')) event.preventDefault()
                }}>
                <SheetHeader className="mb-4 pr-8 text-left">
                  <SheetTitle>{filtersLabel}</SheetTitle>
                  <SheetDescription>{t('dashboard.filters.description')}</SheetDescription>
                </SheetHeader>
                <DashboardFiltersPanel {...panelProps} />
              </SheetContent>
            </Sheet>
            <StartupInvite />
          </>}
          alignTitleWithActions
          className="gap-2"
        />

        {((updating && data) || filterState.activeGroups > 0) && <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
          {updating && data ? t('dashboard.filters.updating') : filterState.activeGroups > 0 ? t('dashboard.filters.applied', { count: filterState.activeGroups }) : null}
        </div>}
        <QueryState isLoading={isLoading} isError={Boolean(error)} error={error} onRetry={() => refetch()}>
          <div className="min-w-0 space-y-4" aria-busy={updating}>
            <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3', sidebarExpanded ? '2xl:grid-cols-6' : 'xl:grid-cols-6')}>
              <MetricCard compact label={t('dashboard.cards.companies')} value={String(total)} icon={<Building2 className="h-4 w-4" />} />
              <MetricCard compact label={t('dashboard.cards.portfolioRevenue')} value={fmtRub(data?.portfolioRevenue ?? null)}
                description={data?.portfolioRevenue == null ? t('dashboard.cards.unavailable.revenue') : undefined}
                icon={<TrendingUp className="h-4 w-4" />} />
              <MetricCard
                compact
                label={t('dashboard.cards.revenueGrowth')}
                description={data?.revenueGrowth == null ? t('dashboard.cards.unavailable.growth') : undefined}
                value={
                  data?.revenueGrowth == null ? (
                    '—'
                  ) : (
                    <span className={data.revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}>{fmtSignedPct(data.revenueGrowth * 100)}</span>
                  )
                }
                icon={<TrendingUp className="h-4 w-4" />}
              />
              <MetricCard compact label={t('dashboard.cards.onTrack')} value={onTrackPct == null ? '—' : `${onTrackPct}%`}
                description={onTrackPct == null ? t('dashboard.cards.unavailable.onTrack') : undefined}
                icon={<CircleCheck className="h-4 w-4" />} />
              <MetricCard compact label={t('dashboard.cards.atRisk')} value={String(data?.companiesAtRisk ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
              <MetricCard
                compact
                label={t('dashboard.cards.avgRunway')}
                description={data?.avgRunway == null ? t('dashboard.cards.unavailable.runway') : undefined}
                value={data?.avgRunway != null ? t('overview.kpi.runwayMonths', { value: Number(data.avgRunway.toFixed(1)) }) : '—'}
                icon={<CalendarClock className="h-4 w-4" />}
              />
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
              <Section
                title={t('dashboard.performance.title')}
                className="min-w-0"
                headerClassName="px-4 py-3 sm:items-center"
                contentClassName="p-4"
                actionsClassName="max-w-full"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <div role="group" aria-label={t('dashboard.performance.periodLabel')} className="flex gap-0.5 rounded-md border border-input bg-card p-0.5">
                      {([3, 6, 12] as Range[]).map((n) => (
                        <Button
                          key={n}
                          type="button"
                          onClick={() => setRange(n)}
                          size="sm"
                          variant="ghost"
                          aria-pressed={range === n}
                          className="h-7 rounded-sm px-2.5 text-xs text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                        >
                          {n}
                        </Button>
                      ))}
                    </div>
                    <div role="group" aria-label={t('dashboard.performance.seriesLabel')} className="flex gap-0.5 rounded-md border border-input bg-card p-0.5">
                      {(
                        [
                          ['both', t('overview.performance.both')],
                          ['fact', t('common.fact')],
                          ['plan', t('common.plan')],
                        ] as [Mode, string][]
                      ).map(([value, label]) => (
                        <Button
                          key={value}
                          type="button"
                          onClick={() => setMode(value)}
                          size="sm"
                          variant="ghost"
                          aria-pressed={mode === value}
                          className="h-7 rounded-sm px-2.5 text-xs text-muted-foreground aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                }
              >
                {/* A previous chart must not be presented with KPI from a new universe. */}
                <QueryState isLoading={updating || performanceQuery.isPlaceholderData || dashboardQuery.isPlaceholderData} isError={performanceQuery.isError} error={performanceQuery.error} onRetry={() => { void performanceQuery.refetch() }}>
                  <PortfolioRevenueChart data={performanceQuery.data ?? []} series={mode === 'both' ? ['fact', 'plan'] : [mode]} />
                </QueryState>
              </Section>
              <CompanyRevenueShareChart companies={companies}
                onResetFilters={filterState.activeGroups > 0 ? filterState.resetFilters : undefined} />
            </div>

            <CompanyRevenueComparisonChart companies={companies}
              onResetFilters={filterState.activeGroups > 0 ? filterState.resetFilters : undefined} />

            <IndustryProfitabilityChart data={data?.profitabilityByIndustry ?? []}
              industryLabel={slug => industryLabel(slug)}
              onResetFilters={filterState.activeGroups > 0 ? filterState.resetFilters : undefined} />

            <PortfolioPlanFactTable companies={companies} onOpen={openCompany}
              onResetFilters={filterState.activeGroups > 0 ? filterState.resetFilters : undefined} />
            <PortfolioUnitEconomicsTable companies={companies} onOpen={openCompany}
              onResetFilters={filterState.activeGroups > 0 ? filterState.resetFilters : undefined} />

            <Section className="min-w-0 overflow-hidden [&>div:last-child]:p-0">
              <Tabs defaultValue="active" className="min-w-0">
                <TabsList
                  aria-label={t('dashboard.lifecycle.tabsLabel')}
                  className="grid h-auto w-full grid-cols-1 gap-0 rounded-none border-b bg-muted/60 p-0 sm:flex sm:flex-wrap"
                >
                  <TabsTrigger value="active" className="justify-start rounded-none px-4 py-3 data-[state=active]:bg-card data-[state=active]:shadow-none">
                    {t('dashboard.lifecycle.activeTitle')} ({companies.length})
                  </TabsTrigger>
                  <TabsTrigger value="attention" className="justify-start rounded-none px-4 py-3 data-[state=active]:bg-card data-[state=active]:shadow-none">
                    {t('dashboard.attention.title')} ({attentionCompanies.length})
                  </TabsTrigger>
                  <TabsTrigger value="archived" className="justify-start rounded-none px-4 py-3 data-[state=active]:bg-card data-[state=active]:shadow-none">
                    {t('dashboard.lifecycle.archiveTitle')} ({archivedQuery.data ? archivedCompanies.length : archivedQuery.isError ? '—' : '…'})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-0">
                  {companies.length === 0 ? (
                    <div className="space-y-3 px-5 py-8 text-center text-sm text-muted-foreground">
                      <p>{t(filterState.activeGroups > 0 ? 'dashboard.filters.empty' : 'dashboard.lifecycle.activeEmpty')}</p>
                      {filterState.activeGroups > 0 && <Button variant="outline" size="sm" onClick={filterState.resetFilters}>{t('dashboard.filters.reset')}</Button>}
                    </div>
                  ) : (
                    <FundCompaniesTable
                      companies={companies}
                      industryLabel={industryLabel}
                      canArchive
                      onOpen={openCompany}
                      onAiAnalysis={aiAnalysis}
                      onArchive={(id) => archiveMutation.mutate(id)}
                    />
                  )}
                </TabsContent>

                <TabsContent value="attention" className="mt-0 px-4 py-2">
                  {attentionCompanies.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">{t('dashboard.attention.empty')}</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {attentionCompanies.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() => openCompany(c.id)}
                            className="flex w-full cursor-pointer flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 dark:hover:bg-blue-950/30 dark:focus-visible:bg-blue-950/30 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="font-medium text-foreground">{c.name}</span>
                            <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              {c.attention.map((a) => (
                                <span
                                  key={a.kind}
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium',
                                    a.severity === 'critical' ? 'bg-danger/10 text-danger' : a.severity === 'warning' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground',
                                  )}
                                >
                                  {dashboardAttentionLabel(a, t)}
                                </span>
                              ))}
                              <ArrowRight className="h-3.5 w-3.5" />
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>

                <TabsContent value="archived" className="mt-0">
                  <p className="border-b px-5 py-3 text-xs text-muted-foreground">{t('dashboard.filters.inactiveNote')}</p>
                  <QueryState
                    isLoading={archivedQuery.isLoading}
                    isError={archivedQuery.isError}
                    error={archivedQuery.error}
                    onRetry={() => { void archivedQuery.refetch() }}
                  >
                    {archivedCompanies.length === 0 ? (
                      <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('dashboard.lifecycle.archiveEmpty')}</p>
                    ) : (
                      <ul className="divide-y divide-border/60">
                        {archivedCompanies.map((c) => (
                          <li
                            key={c.id}
                            tabIndex={0}
                            aria-label={`${t('dashboard.table.open')}: ${c.name}`}
                            onClick={() => openCompany(c.id)}
                            onKeyDown={(event) => {
                              if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault()
                                openCompany(c.id)
                              }
                            }}
                            className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 dark:hover:bg-blue-950/30 dark:focus-visible:bg-blue-950/30"
                          >
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); openCompany(c.id) }}
                              className="min-w-0 truncate text-left text-sm font-medium text-foreground"
                            >
                              {c.name}
                            </button>
                            <div className="flex shrink-0 gap-1" onClick={(event) => event.stopPropagation()}>
                              <Button size="sm" variant="ghost" disabled={isArchiveMutating} onClick={() => restoreMutation.mutate(c.id)}>
                                <RotateCcw className="h-4 w-4" />
                                {t('dashboard.lifecycle.restore')}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={t('dashboard.lifecycle.delete')}
                                className="text-muted-foreground hover:text-destructive"
                                disabled={isArchiveMutating}
                                onClick={() => deleteMutation.mutate(c.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </QueryState>
                </TabsContent>
              </Tabs>
            </Section>
          </div>
        </QueryState>
      </div>
    </div>
  )
}
