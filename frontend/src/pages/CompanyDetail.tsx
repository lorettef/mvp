import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { companiesApi } from '../api/companies'
import { catalogApi } from '../api/catalog'
import { marketApi } from '../api/market'
import { hiringApi } from '../api/hiring'
import { pnlApi } from '../api/pnl'
import { cashflowApi } from '../api/cashflow'
import { creditApi } from '../api/credit'
import { valuationApi } from '../api/valuation'
import { sensitivityApi } from '../api/sensitivity'
import { useAuthStore } from '../store/authStore'
import { getTenantKey } from '../auth/authSession'
import { qk } from '../lib/queryKeys'
import type { Metric, MetricUpsert, CohortUpsert, BudgetUpsert, TaskCreate, TaskUpdate, MarketAnalysisRequest, HiringSettingsUpsert, InsightScenario } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonthPicker } from '@/components/ui/month-picker'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CohortsTab } from '@/components/company/CohortsTab'
import { BudgetTab } from '@/components/company/BudgetTab'
import { UnitEconomicsTab } from '@/components/company/UnitEconomicsTab'
import { TasksTab } from '@/components/company/TasksTab'
import { MarketTab } from '@/components/company/MarketTab'
import { HiringTab } from '@/components/company/HiringTab'
import { PnLTab } from '@/components/company/PnLTab'
import { CashFlowTab } from '@/components/company/CashFlowTab'
import { CreditTab } from '@/components/company/CreditTab'
import { ValuationTab } from '@/components/company/ValuationTab'
import { SensitivityTab } from '@/components/company/SensitivityTab'
import { ReportsTab } from '@/components/company/ReportsTab'
import { AIInsight } from '@/components/company/AIInsight'
import { CompanyConfigDialog } from '@/components/company/CompanyConfigDialog'
import { QueryState } from '@/components/common/QueryState'
import { normalizeApiError } from '@/lib/apiError'
import { fmtPct, fmtPeriod, fmtRub, formatMonthLabel } from '@/lib/format'
import { Sparkles, Plus, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw, Trash2, Settings2 } from 'lucide-react'

interface BulkRow {
  newUnits: string
  arpu: string
  revenue: string
  marketingSpend: string
  retentionPct: string
}

const emptyBulkRow = (): BulkRow => ({
  newUnits: '',
  arpu: '',
  revenue: '',
  marketingSpend: '',
  retentionPct: '',
})

// Required bulk-metrics fields: leaving one empty must NOT silently submit 0
// (backend rejects arpu with gt=0 → 422). marketingSpend is optional.

const addMonths = (ym: string, n: number): string => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const currentMonthValue = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const deriveMetric = (r: BulkRow) => {
  const retention = Math.min(1, Math.max(0, (Number(r.retentionPct) || 0) / 100))
  const churn = 1 - retention
  const arpu = Number(r.arpu) || 0
  const newUnits = Number(r.newUnits) || 0
  const marketing = Number(r.marketingSpend) || 0
  const ltv = churn > 0 ? arpu / churn : arpu * 12
  const cac = newUnits > 0 ? marketing / newUnits : 0
  return { churn, ltv, cac }
}

const scenarioByTab: Record<string, InsightScenario> = {
  unit: 'unit_economics',
  cohorts: 'cohorts',
  budget: 'budget',
  tasks: 'readiness',
  hiring: 'hiring',
  pnl: 'pnl',
  cashflow: 'cashflow',
  credit: 'credit',
  valuation: 'valuation',
  sensitivity: 'sensitivity',
  reports: 'reports',
}

export const CompanyDetail = () => {
  const { t, i18n } = useTranslation()
  const { companyId } = useParams<{ companyId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('metrics')
  const [showForm, setShowForm] = useState(false)
  const [bulkType, setBulkType] = useState<'plan' | 'fact'>('fact')
  const [bulkStartMonth, setBulkStartMonth] = useState(currentMonthValue)
  const [bulkCount, setBulkCount] = useState(3)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()])
  const [bulkError, setBulkError] = useState<string | null>(null)
  const [grossMarginPct, setGrossMarginPct] = useState('75')
  const [metricDeleteId, setMetricDeleteId] = useState<string | null>(null)
  const [configOpen, setConfigOpen] = useState(false)

  const providerLabel = (p: string) =>
    p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : t('company.providerDemo')

  const BUSINESS_MODEL_LABELS: Record<string, string> = {
    subscription: 'Подписка (SaaS)',
    marketplace: 'Маркетплейс',
    retail: 'Онлайн-ритейл',
    financial_services: 'Финансовые сервисы',
    mobile_app: 'Мобильное приложение',
    services: 'Сервисы / Аутсорсинг',
  }

  const INDUSTRY_LABELS: Record<string, string> = {
    saas: 'SaaS',
    fintech: 'Fintech',
    ecommerce: 'E-commerce',
    edtech: 'EdTech',
    healthtech: 'HealthTech',
    ai: 'AI/ML',
    marketplaces: 'Маркетплейсы',
    foodtech: 'FoodTech',
    logistics: 'Логистика',
    proptech: 'PropTech',
    media: 'Медиа и развлечения',
    hardware: 'Hardware / IoT',
    biotech: 'Biotech',
    cleantech: 'CleanTech',
    other: t('common.other'),
  }

  const REQUIRED_BULK_FIELDS: Array<{ key: keyof BulkRow; metricKey: string; fallback: string }> = [
    { key: 'newUnits', metricKey: 'new_units', fallback: t('company.metrics.newUnits') },
    { key: 'arpu', metricKey: 'arpu', fallback: t('company.metrics.arpu') },
    { key: 'revenue', metricKey: 'revenue', fallback: t('company.metrics.revenue') },
    { key: 'retentionPct', metricKey: 'retention_rate', fallback: t('company.metrics.retention') },
  ]

  const id = companyId ?? ''
  const tenantKey = getTenantKey()

  const companyQuery = useQuery({
    queryKey: qk.company(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.get(id, { signal }),
    enabled: Boolean(id),
  })

  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
  })

  const metricLabels = new Map<string, string>()
  if (catalogQuery.data && companyQuery.data?.industry && companyQuery.data?.businessModel) {
    const profile = catalogQuery.data.profiles[companyQuery.data.industry]?.[companyQuery.data.businessModel]
    if (profile) {
      for (const metric of profile.metrics) metricLabels.set(metric.key, metric.label)
    }
  }
  const metricLabel = (key: string, fallback: string) => metricLabels.get(key) ?? fallback

  useEffect(() => {
    const gm = companyQuery.data?.grossMargin
    setGrossMarginPct(gm != null ? String(Math.round(gm * 10000) / 100) : '75')
  }, [companyQuery.data?.grossMargin, id])

  const metricsQuery = useQuery({
    queryKey: qk.companyMetrics(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.metrics(id, undefined, { signal }),
    enabled: Boolean(id) && tab === 'metrics',
  })

  const cohortsQuery = useQuery({
    queryKey: qk.companyCohorts(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.cohorts(id, undefined, { signal }),
    enabled: Boolean(id) && tab === 'cohorts',
  })

  const budgetsQuery = useQuery({
    queryKey: qk.companyBudgets(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.budgets(id, undefined, { signal }),
    enabled: Boolean(id) && tab === 'budget',
  })

  const unitEconomicsQuery = useQuery({
    queryKey: qk.companyUnitEconomics(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.unitEconomics(id, { signal }),
    enabled: Boolean(id) && tab === 'unit',
  })

  const tasksQuery = useQuery({
    queryKey: qk.companyTasks(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.tasks(id, { signal }),
    enabled: Boolean(id) && tab === 'tasks',
  })

  const readinessQuery = useQuery({
    queryKey: qk.companyReadiness(tenantKey, id),
    queryFn: ({ signal }) => companiesApi.readiness(id, { signal }),
    enabled: Boolean(id) && tab === 'tasks',
  })

  const hiringQuery = useQuery({
    queryKey: qk.companyHiring(tenantKey, id),
    queryFn: ({ signal }) => hiringApi.plan(id, { signal }),
    enabled: Boolean(id) && tab === 'hiring',
  })

  const hiringSettingsMutation = useMutation({
    mutationFn: (d: HiringSettingsUpsert) => hiringApi.upsertSettings(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyHiring(tenantKey, id) })
    },
  })

  const pnlQuery = useQuery({
    queryKey: qk.companyPnl(tenantKey, id),
    queryFn: ({ signal }) => pnlApi.get(id, { signal }),
    enabled: Boolean(id) && tab === 'pnl',
  })

  const cashflowQuery = useQuery({
    queryKey: qk.companyCashflow(tenantKey, id),
    queryFn: ({ signal }) => cashflowApi.get(id, { signal }),
    enabled: Boolean(id) && tab === 'cashflow',
  })

  const creditQuery = useQuery({
    queryKey: qk.companyCredit(tenantKey, id),
    queryFn: ({ signal }) => creditApi.forecast(id, { signal }),
    enabled: Boolean(id) && tab === 'credit',
  })

  const valuationQuery = useQuery({
    queryKey: qk.companyValuation(tenantKey, id),
    queryFn: ({ signal }) => valuationApi.get(id, { signal }),
    enabled: Boolean(id) && tab === 'valuation',
  })

  const sensitivityQuery = useQuery({
    queryKey: qk.companySensitivity(tenantKey, id),
    queryFn: ({ signal }) => sensitivityApi.get(id, { signal }),
    enabled: Boolean(id) && tab === 'sensitivity',
  })

  const recalculateMutation = useMutation({
    mutationFn: () => companiesApi.recalculate(id),
    onSuccess: () => {
      // Один префиксный вызов покрывает компанию и все её производные запросы.
      queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, id) })
      queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
    },
  })

  const generatePlanMutation = useMutation({
    mutationFn: () => companiesApi.generatePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyMetrics(tenantKey, id) })
      queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
    },
  })

  const bulkMutation = useMutation({
    mutationFn: () => {
      const items: MetricUpsert[] = bulkRows.map((r, i) => ({
        period: `${addMonths(bulkStartMonth, i)}-01`,
        type: bulkType,
        new_units: Number(r.newUnits) || 0,
        arpu: Number(r.arpu) || 0,
        revenue: Number(r.revenue) || 0,
        marketing_spend: Number(r.marketingSpend) || 0,
        retention_rate: (Number(r.retentionPct) || 0) / 100,
      }))
      return companiesApi.upsertMetricBulk(id, { items })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyMetrics(tenantKey, id) })
      queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
      setShowForm(false)
    },
  })

  const grossMarginMutation = useMutation({
    mutationFn: (value: number) => companiesApi.update(id, { gross_margin: value / 100 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, id) })
    },
  })

  const handleCountChange = (n: number) => {
    setBulkCount(n)
    setBulkRows((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? emptyBulkRow()))
  }

  const updateRow = (i: number, field: keyof BulkRow, value: string) => {
    setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
    if (bulkError) setBulkError(null)
  }

  const handleBulkSave = () => {
    for (let i = 0; i < bulkRows.length; i++) {
      const row = bulkRows[i]
      for (const field of REQUIRED_BULK_FIELDS) {
        const raw = row[field.key].trim()
        if (raw === '' || !Number.isFinite(Number(raw))) {
          setBulkError(t('company.metrics.bulkError', { row: i + 1, field: metricLabel(field.metricKey, field.fallback) }))
          return
        }
      }
    }
    setBulkError(null)
    bulkMutation.mutate()
  }

  const handleGrossMarginSave = () => {
    const v = Number(grossMarginPct)
    if (Number.isFinite(v) && v >= 0 && v <= 100) grossMarginMutation.mutate(v)
  }

  const bulkValid = bulkStartMonth !== '' && bulkCount >= 1 && bulkCount <= 12

  const cohortUpsert = useMutation({
    mutationFn: (d: CohortUpsert) => companiesApi.upsertCohort(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyCohorts(tenantKey, id) })
    },
  })

  const budgetUpsert = useMutation({
    mutationFn: (d: BudgetUpsert) => companiesApi.upsertBudget(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.companyBudgets(tenantKey, id) })
    },
  })

  const deleteMetricMutation = useMutation({
    mutationFn: (metricId: string) => companiesApi.deleteMetric(id, metricId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, id) })
    },
  })

  const deleteCohortMutation = useMutation({
    mutationFn: (cohortId: string) => companiesApi.deleteCohort(id, cohortId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, id) })
    },
  })

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId: string) => companiesApi.deleteBudget(id, budgetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.company(tenantKey, id) })
    },
  })

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: qk.companyTasks(tenantKey, id) })
    queryClient.invalidateQueries({ queryKey: qk.companyReadiness(tenantKey, id) })
    queryClient.invalidateQueries({ queryKey: qk.dashboard(tenantKey) })
  }

  const createTaskMutation = useMutation({
    mutationFn: (d: TaskCreate) => companiesApi.createTask(id, d),
    onSuccess: invalidateTasks,
  })

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: TaskUpdate }) =>
      companiesApi.updateTask(id, taskId, data),
    onSuccess: invalidateTasks,
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => companiesApi.deleteTask(id, taskId),
    onSuccess: invalidateTasks,
  })

  const marketMutation = useMutation({
    mutationFn: (req: MarketAnalysisRequest) => marketApi.analyze(req),
  })

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (companyQuery.error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">{t('company.errorLoading')}</p>
          <p className="text-muted-foreground text-sm mt-1">{(companyQuery.error as Error).message}</p>
        </div>
      </div>
    )
  }

  const company = companyQuery.data
  const metrics = metricsQuery.data ?? []
  const cohorts = cohortsQuery.data ?? []
  const budgets = budgetsQuery.data ?? []
  const unitEconomics = unitEconomicsQuery.data
  const tasks = tasksQuery.data ?? []
  const readiness = readinessQuery.data ?? null

  const canEdit = user?.role === 'admin' || user?.role === 'company'

  const scenario = scenarioByTab[tab]

  const periods = new Map<string, { plan?: Metric; fact?: Metric }>()
  for (const m of metrics) {
    if (!periods.has(m.period)) periods.set(m.period, {})
    const entry = periods.get(m.period)!
    entry[m.type] = m
  }
  const rows = Array.from(periods.entries()).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{company?.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-muted-foreground">
              {company?.industry
                ? INDUSTRY_LABELS[company.industry] ?? company.industry
                : t('company.sphereNotSet')}{' '}
              {company?.businessModel
                ? `· ${BUSINESS_MODEL_LABELS[company.businessModel] ?? company.businessModel} `
                : ''}
              · {company?.geography || t('company.locationNotSet')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfigOpen(true)}
              title={t('dashboard.config.title')}
            >
              <Settings2 className="w-4 h-4 mr-2" />
              {t('dashboard.config.title')}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            {recalculateMutation.isPending ? t('common.recalculating') : t('common.forceRecalc')}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generatePlanMutation.mutate()}
            disabled={!canEdit || generatePlanMutation.isPending}
            title={!canEdit ? t('company.insufficientRights') : t('company.generatePlanTitle')}
          >
            <Sparkles className={`w-4 h-4 mr-2 ${generatePlanMutation.isPending ? 'animate-spin' : ''}`} />
            {generatePlanMutation.isPending ? t('company.generating') : t('company.generatePlan')}
          </Button>
        </div>
      </div>

      {generatePlanMutation.data && (
        <div className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-2">
          {t('company.planGenerated', {
            count: generatePlanMutation.data.metrics.length,
            provider: providerLabel(generatePlanMutation.data.provider),
          })}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="metrics">{t('company.tabs.metrics')}</TabsTrigger>
          <TabsTrigger value="cohorts">{t('company.tabs.cohorts')}</TabsTrigger>
          <TabsTrigger value="budget">{t('company.tabs.budget')}</TabsTrigger>
          <TabsTrigger value="unit">{t('company.tabs.unit')}</TabsTrigger>
          <TabsTrigger value="tasks">{t('company.tabs.tasks')}</TabsTrigger>
          <TabsTrigger value="market">{t('company.tabs.market')}</TabsTrigger>
          <TabsTrigger value="hiring">{t('company.tabs.hiring')}</TabsTrigger>
          <TabsTrigger value="pnl">{t('company.tabs.pnl')}</TabsTrigger>
          <TabsTrigger value="cashflow">{t('company.tabs.cashflow')}</TabsTrigger>
          <TabsTrigger value="credit">{t('company.tabs.credit')}</TabsTrigger>
          <TabsTrigger value="valuation">{t('company.tabs.valuation')}</TabsTrigger>
          <TabsTrigger value="sensitivity">{t('company.tabs.sensitivity')}</TabsTrigger>
          <TabsTrigger value="reports">{t('company.tabs.reports')}</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <QueryState
            isLoading={metricsQuery.isLoading}
            isError={metricsQuery.isError}
            error={metricsQuery.error}
            onRetry={() => metricsQuery.refetch()}
          >
          <Card className="border bg-card/50">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h3 className="font-semibold text-foreground">{t('company.metrics.title')}</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
                      <div>
                        <label
                          htmlFor="gross-margin"
                          className="block text-xs font-medium text-muted-foreground"
                        >
                          {t('company.metrics.grossMargin')}
                        </label>
                        <div className="mt-1 flex items-center gap-1">
                          <Input
                            id="gross-margin"
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            className="h-8 w-24 border-0 bg-transparent px-0 py-0 text-lg font-semibold shadow-none [appearance:textfield] focus-visible:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            aria-label={t('company.metrics.grossMargin')}
                            value={grossMarginPct}
                            onChange={(e) => setGrossMarginPct(e.target.value)}
                          />
                          <span className="text-lg font-semibold text-foreground">%</span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGrossMarginSave}
                        disabled={grossMarginMutation.isPending}
                      >
                        {grossMarginMutation.isPending ? t('common.saving') : t('common.save')}
                      </Button>
                    </div>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                      <Plus className="w-4 h-4 mr-2" />
                      {t('company.metrics.addMetric')}
                    </Button>
                  )}
                </div>
              </div>

              {showForm && canEdit && (
                <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex flex-wrap items-end gap-3 mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{t('common.type')}</span>
                      <div className="flex rounded-md border border-input overflow-hidden">
                        {(['plan', 'fact'] as const).map((t2) => (
                          <button
                            key={t2}
                            type="button"
                            onClick={() => setBulkType(t2)}
                            className={`h-10 px-4 text-sm font-medium transition-colors ${
                              bulkType === t2
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {t2 === 'plan' ? t('common.plan') : t('common.fact')}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{t('company.metrics.startMonth')}</span>
                      <MonthPicker
                        aria-label={t('company.metrics.startMonth')}
                        value={bulkStartMonth}
                        onChange={setBulkStartMonth}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">{t('company.metrics.months')}</span>
                      <select
                        aria-label={t('company.metrics.months')}
                        value={bulkCount}
                        onChange={(e) => handleCountChange(Number(e.target.value))}
                        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="text-left font-medium px-2 py-2">{t('common.month')}</th>
                          <th className="text-left font-medium px-2 py-2">{metricLabel('new_units', t('company.metrics.newUnits'))}</th>
                          <th className="text-left font-medium px-2 py-2">{metricLabel('arpu', t('company.metrics.arpuRub'))}</th>
                          <th className="text-left font-medium px-2 py-2">{metricLabel('revenue', t('company.metrics.revenueRub'))}</th>
                          <th className="text-left font-medium px-2 py-2">{metricLabel('marketing_spend', t('common.marketingRub'))}</th>
                          <th className="text-left font-medium px-2 py-2">{metricLabel('retention_rate', t('company.metrics.retention'))}</th>
                          <th className="text-left font-medium px-2 py-2">{t('company.metrics.ltvRub')}</th>
                          <th className="text-left font-medium px-2 py-2">{t('company.metrics.cacRub')}</th>
                          <th className="text-left font-medium px-2 py-2">{t('company.metrics.churn')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((r, i) => {
                          const d = deriveMetric(r)
                          return (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="px-2 py-2 font-medium text-foreground whitespace-nowrap">
                                {formatMonthLabel(addMonths(bulkStartMonth, i), i18n.language)}
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={t('company.metrics.rowNewUnits', { row: i + 1 })}
                                  value={r.newUnits}
                                  onChange={(e) => updateRow(i, 'newUnits', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={t('company.metrics.rowArpu', { row: i + 1 })}
                                  value={r.arpu}
                                  onChange={(e) => updateRow(i, 'arpu', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={t('company.metrics.rowRevenue', { row: i + 1 })}
                                  value={r.revenue}
                                  onChange={(e) => updateRow(i, 'revenue', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={t('company.metrics.rowMarketing', { row: i + 1 })}
                                  value={r.marketingSpend}
                                  onChange={(e) => updateRow(i, 'marketingSpend', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  aria-label={t('company.metrics.rowRetention', { row: i + 1 })}
                                  value={r.retentionPct}
                                  onChange={(e) => updateRow(i, 'retentionPct', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                                {fmtRub(d.ltv)}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                                {fmtRub(d.cac)}
                              </td>
                              <td className="px-2 py-2 text-muted-foreground whitespace-nowrap">
                                {fmtPct(d.churn)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {bulkError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {bulkError}
                    </p>
                  )}
                  {bulkMutation.isError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {normalizeApiError(bulkMutation.error).message}
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={!bulkValid || bulkMutation.isPending}
                      onClick={handleBulkSave}
                    >
                      {bulkMutation.isPending ? t('common.saving') : t('company.metrics.saveMetrics')}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                      {t('common.cancel')}
                    </Button>
                  </div>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left font-medium px-4 py-3">{t('common.period')}</th>
                    <th className="text-left font-medium px-4 py-3">
                      {metricLabel('revenue', t('company.metrics.revenue'))} · {t('common.plan')}
                    </th>
                    <th className="text-left font-medium px-4 py-3">
                      {metricLabel('revenue', t('company.metrics.revenue'))} · {t('common.fact')}
                    </th>
                    <th className="text-left font-medium px-4 py-3">{t('company.metrics.deviation')}</th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                      {metricLabel('new_units', t('company.metrics.newUnits'))}
                    </th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                      {metricLabel('retention_rate', t('company.metrics.retention'))}
                    </th>
                    {canEdit && (
                      <th className="w-12 px-4 py-3" aria-label={t('common.actions')} />
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([period, entry]) => {
                    const planRevenue = entry.plan?.revenue
                    const factRevenue = entry.fact?.revenue
                    const dev =
                      planRevenue != null && factRevenue != null
                        ? factRevenue - planRevenue
                        : null
                    const devPct =
                      dev != null && planRevenue ? (dev / planRevenue) * 100 : null
                    const positive = dev != null && dev >= 0
                    return (
                      <tr
                        key={period}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-foreground">
                          {fmtPeriod(period)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtRub(planRevenue)}
                        </td>
                        <td className="px-4 py-3 text-foreground">{fmtRub(factRevenue)}</td>
                        <td className="px-4 py-3">
                          {dev == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                positive ? 'text-emerald-500' : 'text-destructive'
                              }`}
                            >
                              {positive ? (
                                <ArrowUpRight className="w-4 h-4" />
                              ) : (
                                <ArrowDownRight className="w-4 h-4" />
                              )}
                              {devPct != null
                                ? `${devPct >= 0 ? '+' : ''}${devPct.toFixed(1)}%`
                                : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {entry.fact?.newUnits ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                          {fmtPct(entry.fact?.retentionRate)}
                        </td>
                        {canEdit && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              {[entry.plan, entry.fact].map((metric) =>
                                metric ? (
                                  <Button
                                    key={metric.id}
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    aria-label={t('company.metrics.delete')}
                                    onClick={() => setMetricDeleteId(metric.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                ) : null,
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6 + (canEdit ? 1 : 0)} className="px-4 py-8 text-center text-muted-foreground">
                        {t('company.metrics.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
          </QueryState>
        </TabsContent>

        <TabsContent value="cohorts">
          <QueryState
            isLoading={cohortsQuery.isLoading}
            isError={cohortsQuery.isError}
            error={cohortsQuery.error}
            onRetry={() => cohortsQuery.refetch()}
          >
          <CohortsTab
            cohorts={cohorts}
            canEdit={canEdit}
            onSubmit={(d) => cohortUpsert.mutate(d)}
            onDelete={(cohortId) => deleteCohortMutation.mutate(cohortId)}
            isPending={cohortUpsert.isPending}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="budget">
          <QueryState
            isLoading={budgetsQuery.isLoading}
            isError={budgetsQuery.isError}
            error={budgetsQuery.error}
            onRetry={() => budgetsQuery.refetch()}
          >
          <BudgetTab
            budgets={budgets}
            canEdit={canEdit}
            onSubmit={(d) => budgetUpsert.mutate(d)}
            onDelete={(budgetId) => deleteBudgetMutation.mutate(budgetId)}
            isPending={budgetUpsert.isPending}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="unit">
          <QueryState
            isLoading={unitEconomicsQuery.isLoading}
            isError={unitEconomicsQuery.isError}
            error={unitEconomicsQuery.error}
            onRetry={() => unitEconomicsQuery.refetch()}
            isEmpty={unitEconomicsQuery.data == null}
            emptyText={t('company.unit.empty')}
          >
          <UnitEconomicsTab
            data={unitEconomics}
            isLoading={unitEconomicsQuery.isLoading}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="tasks">
          <QueryState
            isLoading={tasksQuery.isLoading || readinessQuery.isLoading}
            isError={tasksQuery.isError || readinessQuery.isError}
            error={tasksQuery.error ?? readinessQuery.error}
            onRetry={() => {
              tasksQuery.refetch()
              readinessQuery.refetch()
            }}
          >
          <TasksTab
            tasks={tasks}
            readiness={readiness}
            canEdit={canEdit}
            onCreate={(d) => createTaskMutation.mutate(d)}
            onUpdate={(taskId, d) => updateTaskMutation.mutate({ taskId, data: d })}
            onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
            isPending={createTaskMutation.isPending}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="market">
          <QueryState
            isLoading={marketMutation.isPending}
            isError={marketMutation.isError}
            error={marketMutation.error}
            onRetry={() => marketMutation.reset()}
          >
          <MarketTab
            data={marketMutation.data ?? null}
            isLoading={marketMutation.isPending}
            onAnalyze={(req) => marketMutation.mutate(req)}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="hiring">
          <QueryState
            isLoading={hiringQuery.isLoading}
            isError={hiringQuery.isError}
            error={hiringQuery.error}
            onRetry={() => hiringQuery.refetch()}
            isEmpty={hiringQuery.data == null}
            emptyText={t('company.hiring.empty')}
          >
          <HiringTab
            data={hiringQuery.data}
            isLoading={hiringQuery.isLoading}
            isRefetching={hiringQuery.isFetching}
            isSaving={hiringSettingsMutation.isPending}
            canEdit={canEdit}
            onGenerate={() => hiringQuery.refetch()}
            onSaveSettings={(d) => hiringSettingsMutation.mutate(d)}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="pnl">
          <QueryState
            isLoading={pnlQuery.isLoading}
            isError={pnlQuery.isError}
            error={pnlQuery.error}
            onRetry={() => pnlQuery.refetch()}
            isEmpty={pnlQuery.data == null}
            emptyText={t('company.pnl.empty')}
          >
          <PnLTab data={pnlQuery.data} isLoading={pnlQuery.isLoading} />
          </QueryState>
        </TabsContent>

        <TabsContent value="cashflow">
          <QueryState
            isLoading={cashflowQuery.isLoading}
            isError={cashflowQuery.isError}
            error={cashflowQuery.error}
            onRetry={() => cashflowQuery.refetch()}
            isEmpty={cashflowQuery.data == null}
            emptyText={t('company.cashflow.empty')}
          >
          <CashFlowTab
            data={cashflowQuery.data}
            isLoading={cashflowQuery.isLoading}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="credit">
          <QueryState
            isLoading={creditQuery.isLoading}
            isError={creditQuery.isError}
            error={creditQuery.error}
            onRetry={() => creditQuery.refetch()}
            isEmpty={creditQuery.data == null}
            emptyText={t('company.credit.empty')}
          >
          <CreditTab data={creditQuery.data} isLoading={creditQuery.isLoading} />
          </QueryState>
        </TabsContent>

        <TabsContent value="valuation">
          <QueryState
            isLoading={valuationQuery.isLoading}
            isError={valuationQuery.isError}
            error={valuationQuery.error}
            onRetry={() => valuationQuery.refetch()}
            isEmpty={valuationQuery.data == null}
            emptyText={t('company.valuation.empty')}
          >
          <ValuationTab
            data={valuationQuery.data}
            isLoading={valuationQuery.isLoading}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="sensitivity">
          <QueryState
            isLoading={sensitivityQuery.isLoading}
            isError={sensitivityQuery.isError}
            error={sensitivityQuery.error}
            onRetry={() => sensitivityQuery.refetch()}
            isEmpty={sensitivityQuery.data == null}
            emptyText={t('company.sensitivity.empty')}
          >
          <SensitivityTab
            data={sensitivityQuery.data}
            isLoading={sensitivityQuery.isLoading}
          />
          </QueryState>
        </TabsContent>

        <TabsContent value="reports">
          <QueryState>
          <ReportsTab companyId={id} />
          </QueryState>
        </TabsContent>
      </Tabs>

      {scenario && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <AIInsight companyId={id} scenario={scenario} />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={metricDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setMetricDeleteId(null)
        }}
        title={t('company.delete.title')}
        description={t('company.delete.description')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        danger
        onConfirm={() => {
          if (metricDeleteId !== null) deleteMetricMutation.mutate(metricDeleteId)
          setMetricDeleteId(null)
        }}
      />

      <CompanyConfigDialog
        open={configOpen}
        company={company ?? null}
        tenantKey={tenantKey}
        onOpenChange={setConfigOpen}
      />
    </div>
  )
}
