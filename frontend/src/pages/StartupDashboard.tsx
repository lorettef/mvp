import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { companiesApi } from '@/api/companies'
import { catalogApi } from '@/api/catalog'
import { pnlApi } from '@/api/pnl'
import { useAuthStore } from '@/store/authStore'
import { getTenantKey } from '@/auth/authSession'
import { qk } from '@/lib/queryKeys'
import { PageHeader } from '@/components/shared/page-header'
import { Section } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricHelp } from '@/components/shared/metric-help'
import { CompanyConfigDialog } from '@/components/company/CompanyConfigDialog'
import { StartupKpi } from '@/components/dashboard/StartupKpi'
import { BusinessHealth } from '@/components/dashboard/BusinessHealth'
import { DashboardAIInsight } from '@/components/dashboard/DashboardAIInsight'
import { NextActions, type SuggestedAction } from '@/components/dashboard/NextActions'
import { TrendChart } from '@/components/dashboard/TrendChart'
import { monthSeries } from '@/lib/kpi'
import { fmtFactor, fmtPct, fmtRub } from '@/lib/format'
import { Settings2, Sparkles, LayoutGrid, ArrowRight } from 'lucide-react'
import type { Cohort, Metric, PnLResponse, Task, TaskCreate } from '@/types/api'

type Range = 3 | 6 | 12
type Mode = 'both' | 'fact' | 'plan'

const EMPTY_METRICS: Metric[] = []
const EMPTY_COHORTS: Cohort[] = []

function MetricValue({ label, value, sub, description }: { label: string; value: string; sub?: string; description?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      {description ? (
        <MetricHelp label={label} description={description} className="text-xs text-muted-foreground" />
      ) : (
        <p className="text-xs text-muted-foreground">{label}</p>
      )}
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export function StartupDashboard({ companyId }: { companyId: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const tenantKey = getTenantKey()
  const aiRef = useRef<HTMLDivElement>(null)

  const [range, setRange] = useState<Range>(6)
  const [mode, setMode] = useState<Mode>('both')
  const [configOpen, setConfigOpen] = useState(false)

  const companyQuery = useQuery({
    queryKey: qk.company(tenantKey, companyId),
    queryFn: ({ signal }) => companiesApi.get(companyId, { signal }),
    enabled: Boolean(companyId),
  })
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
  })
  const metricsQuery = useQuery({
    queryKey: qk.companyMetrics(tenantKey, companyId),
    queryFn: ({ signal }) => companiesApi.metrics(companyId, undefined, { signal }),
    enabled: Boolean(companyId),
  })
  const unitQuery = useQuery({
    queryKey: qk.companyUnitEconomics(tenantKey, companyId),
    queryFn: ({ signal }) => companiesApi.unitEconomics(companyId, { signal }),
    enabled: Boolean(companyId),
  })
  const cohortsQuery = useQuery({
    queryKey: qk.companyCohorts(tenantKey, companyId),
    queryFn: ({ signal }) => companiesApi.cohorts(companyId, undefined, { signal }),
    enabled: Boolean(companyId),
  })
  const healthQuery = useQuery({
    queryKey: qk.companyHealth(tenantKey, companyId),
    queryFn: ({ signal }) => companiesApi.health(companyId, { signal }),
    enabled: Boolean(companyId),
  })
  const tasksQuery = useQuery({
    queryKey: qk.companyTasks(tenantKey, companyId),
    queryFn: ({ signal }) => companiesApi.tasks(companyId, { signal }),
    enabled: Boolean(companyId),
  })
  const pnlQuery = useQuery({
    queryKey: qk.companyPnl(tenantKey, companyId),
    queryFn: ({ signal }) => pnlApi.get(companyId, { signal }),
    enabled: Boolean(companyId),
  })

  const createTaskMutation = useMutation({
    mutationFn: (data: TaskCreate) => companiesApi.createTask(companyId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.companyTasks(tenantKey, companyId) })
      void queryClient.invalidateQueries({ queryKey: qk.companyReadiness(tenantKey, companyId) })
    },
  })

  const canEdit = user?.role === 'admin' || user?.role === 'company'

  const deepLink = (target: string) => navigate(`/companies/${companyId}?tab=${target}`)
  const scrollToAi = () => aiRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const company = companyQuery.data
  const metrics = metricsQuery.data ?? EMPTY_METRICS
  const unit = unitQuery.data
  const cohorts = cohortsQuery.data ?? EMPTY_COHORTS
  const health = healthQuery.data
  const tasks = tasksQuery.data ?? []
  const pnl: PnLResponse | undefined = pnlQuery.data

  const industryLabel = company?.industry
    ? (catalogQuery.data?.industries.find((i) => i.slug === company.industry)?.label ?? company.industry)
    : t('company.sphereNotSet')
  const businessModelLabel = company?.businessModel
    ? (catalogQuery.data?.business_models.find((b) => b.slug === company.businessModel)?.label ?? company.businessModel)
    : null

  const series = useMemo(() => monthSeries(metrics).slice(-range), [metrics, range])
  const chartLines: ('fact' | 'plan')[] = mode === 'both' ? ['fact', 'plan'] : [mode]

  const aiTasks: Task[] = tasks.filter((task) => task.source === 'ai_recommendation' && task.status !== 'done')

  const suggested: SuggestedAction[] = []
  if (metrics.length === 0) suggested.push({ id: 'add-metrics', label: t('overview.actions.addMetrics'), target: 'metrics' })
  if (cohorts.length === 0) suggested.push({ id: 'add-cohorts', label: t('overview.actions.addCohorts'), target: 'cohorts' })
  if (!unit?.monthlyBurn) suggested.push({ id: 'add-budget', label: t('overview.actions.addBudget'), target: 'budget' })
  const cacRising = health?.signals.some((s) => s.key === 'cac' && s.status === 'bad')
  if (cacRising) suggested.push({ id: 'check-cac', label: t('overview.actions.checkCac'), target: 'unit' })

  const recentCohorts: Cohort[] = useMemo(
    () => [...cohorts].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 4),
    [cohorts],
  )

  const finBlocks = [
    { label: t('overview.financial.cash'), value: fmtRub(unit?.cash ?? null) },
    { label: t('overview.financial.burn'), value: fmtRub(unit?.monthlyBurn ?? null) },
    { label: t('overview.financial.runway'), value: unit?.runwayMonths != null ? t('overview.kpi.runwayMonths', { value: unit.runwayMonths }) : '—' },
    { label: t('overview.financial.netProfit'), value: fmtRub(pnl?.netProfit ?? null) },
  ]
  const financialEmpty = finBlocks.every((b) => b.value === '—')

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (companyQuery.isError || !company) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-center">
        <p className="text-destructive font-medium">{t('company.errorLoading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={company.name}
        alignTitleWithActions
        description={
          <span>
            {industryLabel}
            {businessModelLabel ? ` · ${businessModelLabel}` : ''} · {company.geography || t('company.locationNotSet')}
          </span>
        }
        actions={
          <>
            <Button size="sm" variant="outline" onClick={scrollToAi}>
              <Sparkles className="h-4 w-4" />
              {t('overview.actions.aiAnalysis')}
            </Button>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setConfigOpen(true)}>
                <Settings2 className="h-4 w-4" />
                {t('overview.actions.config')}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => navigate(`/companies/${companyId}`)}>
              <LayoutGrid className="h-4 w-4" />
              {t('overview.actions.deepDive')}
            </Button>
          </>
        }
      />

      <StartupKpi company={company} catalog={catalogQuery.data} metrics={metrics} unitEconomics={unit} />

      <Section
        title={t('overview.performance.title')}
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
        {metrics.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t('overview.performance.empty')}</p>
            <Button size="sm" className="mt-3" onClick={() => deepLink('metrics')}>
              {t('overview.performance.goMetrics')}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <TrendChart data={series} lines={chartLines} />
        )}
      </Section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section title={t('overview.financial.title')}>
          {financialEmpty ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">{t('overview.financial.empty')}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => deepLink('budget')}>
                {t('overview.actions.addBudget')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {finBlocks.map((b) => (
                <MetricValue key={b.label} label={b.label} value={b.value} />
              ))}
            </div>
          )}
        </Section>

        <Section title={t('overview.unit.title')}>
          <div className="grid grid-cols-2 gap-3">
            <MetricValue label={t('overview.unit.cac')} value={fmtRub(unit?.cac ?? null)} description={t('overview.metricHelp.cac')} />
            <MetricValue label={t('overview.unit.ltv')} value={fmtRub(unit?.ltv ?? null)} description={t('overview.metricHelp.ltv')} />
            <MetricValue label={t('overview.unit.ltvCac')} value={fmtFactor(unit?.ltvCac ?? null)} />
            <MetricValue label={t('overview.unit.payback')} value={unit?.paybackPeriod != null ? t('overview.unit.months', { value: unit.paybackPeriod }) : '—'} />
            <MetricValue
              label={t('overview.unit.grossMargin')}
              value={fmtPct(company.grossMargin)}
              sub={t('overview.unit.grossMarginParam')}
            />
            <MetricValue label={t('overview.unit.arpu')} value={fmtRub(metrics.find((m) => m.type === 'fact')?.arpu ?? null)} description={t('overview.metricHelp.arpu')} />
          </div>
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title={t('overview.cohorts.title')}
          actions={
            <Button size="sm" variant="ghost" onClick={() => deepLink('cohorts')}>
              {t('overview.cohorts.full')}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          }
        >
          {recentCohorts.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted-foreground">{t('overview.cohorts.empty')}</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={() => deepLink('cohorts')}>
                {t('overview.cohorts.goCohorts')}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-2 py-2 text-left font-medium">{t('company.cohorts.cohort')}</th>
                    {['M1', 'M3', 'M6', 'M12'].map((m) => (
                      <th key={m} className="px-2 py-2 text-right font-medium">{m}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentCohorts.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-2 font-medium text-foreground">{c.period.slice(0, 7)}</td>
                      {(['retentionM1', 'retentionM3', 'retentionM6', 'retentionM12'] as const).map((k) => {
                        const v = c[k]
                        return (
                          <td key={k} className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {v == null ? '—' : fmtPct(v)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title={t('overview.health.title')}>
          {health ? (
            <BusinessHealth data={health} />
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
          )}
        </Section>
      </div>

      <div ref={aiRef}>
        <Section title={t('overview.ai.title')}>
          <DashboardAIInsight
            companyId={companyId}
            onCreateTask={(title, description) =>
              createTaskMutation.mutate({ title, description, stage: 'metrics', status: 'pending', source: 'ai_recommendation' })
            }
            onOpenTasks={() => deepLink('tasks')}
          />
        </Section>
      </div>

      <Section title={t('overview.actions.title')}>
        <NextActions
          aiTasks={aiTasks}
          suggested={suggested}
          onOpen={deepLink}
          emptyText={t('overview.actions.empty')}
        />
      </Section>

      <CompanyConfigDialog
        open={configOpen}
        company={company}
        tenantKey={tenantKey}
        onOpenChange={setConfigOpen}
      />
    </div>
  )
}
