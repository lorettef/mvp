import { usePermissions } from '@/hooks/usePermissions'
import { PortfolioAIInsight } from '@/components/dashboard/PortfolioAIInsight'
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
import { QueryState } from '@/components/common/QueryState'
import { PageHeader } from '@/components/shared/page-header'
import { Section } from '@/components/shared/section'
import { PortfolioKpiStrip } from '@/components/dashboard/PortfolioKpiStrip'
import { FundCompaniesTable } from '@/components/dashboard/FundCompaniesTable'
import { CompanyRevenueComparisonChart } from '@/components/dashboard/CompanyRevenueComparisonChart'
import { CompanyRevenueShareChart } from '@/components/dashboard/CompanyRevenueShareChart'
import { IndustryProfitabilityChart } from '@/components/dashboard/IndustryProfitabilityChart'
import { PortfolioRevenueChart } from '@/components/dashboard/PortfolioRevenueChart'
import { PortfolioPerformanceStatusChart, PortfolioRunwayChart } from '@/components/dashboard/PortfolioStatusCharts'
import { PortfolioPlanFactTable, PortfolioUnitEconomicsTable } from '@/components/dashboard/PortfolioSummaryTables'
import { dashboardAttentionLabel } from '@/lib/dashboardAttention'
import { RotateCcw, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Range = 3 | 6 | 12
type Mode = 'both' | 'fact' | 'plan'

export const CompaniesDashboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const permissions = usePermissions()
  const canOpen = permissions.canManagePortfolio
  const CompanyName = canOpen ? 'button' : 'span'
  const AttentionRow = canOpen ? 'button' : 'div'
  const rowInteraction = canOpen && 'cursor-pointer transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 dark:hover:bg-blue-950/30 dark:focus-visible:bg-blue-950/30'
  const queryClient = useQueryClient()
  const [range, setRange] = useState<Range>(6)
  const [mode, setMode] = useState<Mode>('both')

  const tenantKey = getTenantKey()

  const dashboardQuery = useQuery({
    queryKey: qk.dashboard(tenantKey),
    queryFn: ({ signal }) => dashboardApi.get({ signal }),
  })
  const { data, isLoading, error, refetch } = dashboardQuery

  const performanceQuery = useQuery({
    queryKey: qk.dashboardPerformance(tenantKey, range),
    queryFn: ({ signal }) => dashboardApi.performance(range, { signal }),
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

  const industryLabels = new Map((catalogQuery.data?.industries ?? []).map((i) => [i.slug, i.label]))
  const industryLabel = (slug: string | null) => (slug ? (industryLabels.get(slug) ?? slug) : '—')

  const companies = data?.companies ?? []
  const attentionCompanies = companies.filter((c) => c.attention.length > 0)
  const archivedCompanies = archivedQuery.data ?? []

  const openCompany = (id: string) => navigate(`/companies/${id}`)
  const aiAnalysis = (id: string) => navigate(`/companies/${id}?tab=unit`)

  const isArchiveMutating = archiveMutation.isPending || restoreMutation.isPending || deleteMutation.isPending
  return (
    <div className="min-w-0 space-y-4">
        <PageHeader title={t('dashboard.title')} />
        <QueryState isLoading={isLoading} isError={Boolean(error)} error={error} onRetry={() => refetch()}>
          <div className="min-w-0 space-y-4" aria-busy={dashboardQuery.isFetching || performanceQuery.isFetching}>
            <PortfolioKpiStrip data={data} className="xl:grid-cols-6" />

            <div role="group" aria-label={t('dashboard.analytics.grid')} className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-2 min-[1366px]:grid-cols-3">
              <Section
                title={t('dashboard.analytics.revenue')}
                className="min-w-0 h-full"
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
                <QueryState isLoading={performanceQuery.isLoading} isError={performanceQuery.isError} error={performanceQuery.error} onRetry={() => { void performanceQuery.refetch() }}>
                  <PortfolioRevenueChart data={performanceQuery.data ?? []} series={mode === 'both' ? ['fact', 'plan'] : [mode]} />
                </QueryState>
              </Section>
              <Section title={t('dashboard.analytics.share')} className="h-full" headerClassName="px-4 py-3" contentClassName="p-4">
                <CompanyRevenueShareChart embedded companies={companies} />
              </Section>
              <Section title={t('dashboard.analytics.comparison')} className="h-full" headerClassName="px-4 py-3" contentClassName="p-4">
                <CompanyRevenueComparisonChart embedded companies={companies} />
              </Section>
              <Section title={t('dashboard.analytics.industry')} className="h-full" headerClassName="px-4 py-3" contentClassName="p-4">
                <IndustryProfitabilityChart embedded data={data?.profitabilityByIndustry ?? []} industryLabel={slug => industryLabel(slug)} />
              </Section>
              <Section title={t('dashboard.analytics.status')} className="h-full" headerClassName="px-4 py-3" contentClassName="p-4">
                <PortfolioPerformanceStatusChart companies={companies} />
              </Section>
              <Section title={t('dashboard.analytics.runway')} className="h-full" headerClassName="px-4 py-3" contentClassName="p-4">
                <PortfolioRunwayChart companies={companies} />
              </Section>
            </div>

            <PortfolioPlanFactTable companies={companies} onOpen={canOpen ? openCompany : undefined} />
            <PortfolioUnitEconomicsTable companies={companies} onOpen={canOpen ? openCompany : undefined} />

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
                      <p>{t('dashboard.lifecycle.activeEmpty')}</p>
                    </div>
                  ) : (
                    <FundCompaniesTable
                      companies={companies}
                      industryLabel={industryLabel}
                      canArchive={permissions.canManagePortfolio}
                      onOpen={canOpen ? openCompany : undefined}
                      onAiAnalysis={canOpen ? aiAnalysis : undefined}
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
                          <AttentionRow
                            type={canOpen ? 'button' : undefined}
                            onClick={canOpen ? () => openCompany(c.id) : undefined}
                            className={cn(rowInteraction, 'flex w-full flex-col gap-1 px-3 py-3 text-left sm:flex-row sm:items-center sm:justify-between')}
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
                              {canOpen && <ArrowRight className="h-3.5 w-3.5" />}
                            </span>
                          </AttentionRow>
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
                            tabIndex={canOpen ? 0 : undefined}
                            aria-label={canOpen ? `${t('dashboard.table.open')}: ${c.name}` : undefined}
                            onClick={canOpen ? () => openCompany(c.id) : undefined}
                            onKeyDown={canOpen ? (event) => {
                              if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                                event.preventDefault()
                                openCompany(c.id)
                              }
                            } : undefined}
                            className={cn(rowInteraction, 'flex flex-wrap items-center justify-between gap-3 px-5 py-3')}
                          >
                            <CompanyName
                              type={canOpen ? 'button' : undefined}
                              onClick={canOpen ? (event) => { event.stopPropagation(); openCompany(c.id) } : undefined}
                              className="min-w-0 truncate text-left text-sm font-medium text-foreground"
                            >
                              {c.name}
                            </CompanyName>
                            {permissions.canManagePortfolio && <div className="flex shrink-0 gap-1" onClick={(event) => event.stopPropagation()}>
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
                            </div>}
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
        <PortfolioAIInsight />
    </div>
  )
}
