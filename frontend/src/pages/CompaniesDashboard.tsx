import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dashboardApi, companiesApi } from '../api/companies'
import { catalogApi } from '../api/catalog'
import { getTenantKey } from '../auth/authSession'
import { qk } from '../lib/queryKeys'
import { Button } from '@/components/ui/button'
import { QueryState } from '@/components/common/QueryState'
import { StartupInvite } from '@/components/common/StartupInvite'
import { CompanyOnboardingWizard } from '@/components/company/CompanyOnboardingWizard'
import { PageHeader } from '@/components/shared/page-header'
import { Section } from '@/components/shared/section'
import { MetricCard } from '@/components/shared/metric-card'
import { FundCompaniesTable } from '@/components/dashboard/FundCompaniesTable'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { fmtRub, fmtSignedPct } from '@/lib/format'
import { Building2, TrendingUp, CircleCheck, AlertTriangle, CalendarClock, Plus, RefreshCw, RotateCcw, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type Range = 3 | 6 | 12
type Mode = 'both' | 'fact' | 'plan'

export const CompaniesDashboard = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [range, setRange] = useState<Range>(6)
  const [mode, setMode] = useState<Mode>('both')

  const tenantKey = getTenantKey()

  const { data, isLoading, error, isFetching, refetch } = useQuery({
    queryKey: qk.dashboard(tenantKey),
    queryFn: ({ signal }) => dashboardApi.get({ signal }),
  })

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

  return (
    <QueryState isLoading={isLoading} isError={Boolean(error)} error={error} onRetry={() => refetch()}>
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

        <CompanyOnboardingWizard open={showForm} tenantKey={tenantKey} onClose={() => setShowForm(false)} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard label={t('dashboard.cards.companies')} value={String(total)} icon={<Building2 className="h-4 w-4" />} />
          <MetricCard label={t('dashboard.cards.portfolioRevenue')} value={fmtRub(data?.portfolioRevenue ?? null)} icon={<TrendingUp className="h-4 w-4" />} />
          <MetricCard
            label={t('dashboard.cards.revenueGrowth')}
            value={
              data?.revenueGrowth == null ? (
                '—'
              ) : (
                <span className={data.revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}>{fmtSignedPct(data.revenueGrowth * 100)}</span>
              )
            }
            icon={<TrendingUp className="h-4 w-4" />}
          />
          <MetricCard label={t('dashboard.cards.onTrack')} value={onTrackPct == null ? '—' : `${onTrackPct}%`} icon={<CircleCheck className="h-4 w-4" />} />
          <MetricCard label={t('dashboard.cards.atRisk')} value={String(data?.companiesAtRisk ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
          <MetricCard
            label={t('dashboard.cards.avgRunway')}
            value={data?.avgRunway != null ? t('overview.kpi.runwayMonths', { value: data.avgRunway }) : '—'}
            icon={<CalendarClock className="h-4 w-4" />}
          />
        </div>

        <Section
          title={t('dashboard.performance.title')}
          actions={
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-input">
                {([3, 6, 12] as Range[]).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRange(n)}
                    className={`h-8 px-3 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                      range === n ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex rounded-md border border-input">
                {(
                  [
                    ['both', t('overview.performance.both')],
                    ['fact', t('common.fact')],
                    ['plan', t('common.plan')],
                  ] as [Mode, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`h-8 px-3 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md ${
                      mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {(performanceQuery.data?.length ?? 0) === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t('overview.performance.empty')}</p>
          ) : (
            <TrendChart data={performanceQuery.data ?? []} lines={mode === 'both' ? ['fact', 'plan'] : [mode]} />
          )}
        </Section>

        <Section title={t('dashboard.attention.title')}>
          {attentionCompanies.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t('dashboard.attention.empty')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {attentionCompanies.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openCompany(c.id)}
                    className="flex w-full flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"
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
                          {a.label}
                        </span>
                      ))}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title={t('dashboard.lifecycle.activeTitle')}
          actions={<span className="text-sm text-muted-foreground tabular-nums">{companies.length}</span>}
          className="[&>div:last-child]:p-0"
        >
          {companies.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('dashboard.lifecycle.activeEmpty')}</p>
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
        </Section>

        <Section
          title={t('dashboard.lifecycle.archiveTitle')}
          actions={<span className="text-sm text-muted-foreground tabular-nums">{archivedCompanies.length}</span>}
          className="[&>div:last-child]:p-0"
        >
          {archivedCompanies.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{t('dashboard.lifecycle.archiveEmpty')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {archivedCompanies.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">{c.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" disabled={isArchiveMutating} onClick={() => restoreMutation.mutate(c.id)}>
                      <RotateCcw className="h-4 w-4" />
                      {t('dashboard.lifecycle.restore')}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
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
        </Section>
      </div>
    </QueryState>
  )
}
