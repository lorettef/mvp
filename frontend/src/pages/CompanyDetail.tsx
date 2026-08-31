import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { companiesApi } from '../api/companies'
import { marketApi } from '../api/market'
import { hiringApi } from '../api/hiring'
import { pnlApi } from '../api/pnl'
import { cashflowApi } from '../api/cashflow'
import { creditApi } from '../api/credit'
import { valuationApi } from '../api/valuation'
import { sensitivityApi } from '../api/sensitivity'
import { useAuthStore } from '../store/authStore'
import type { Metric, MetricUpsert, CohortUpsert, BudgetUpsert, TaskCreate, TaskUpdate, MarketAnalysisRequest, HiringSettingsUpsert, InsightScenario } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { Sparkles, Plus, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'

const fmtRub = (v: number | null | undefined) => (v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`)

const fmtPeriod = (period: string) => (period ? period.slice(0, 7) : '—')

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

const providerLabel = (p: string) =>
  p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : 'демо-режим'

const INDUSTRY_LABELS: Record<string, string> = {
  saas: 'SaaS',
  fintech: 'Fintech',
  ecommerce: 'E-commerce',
  edtech: 'EdTech',
  healthtech: 'HealthTech',
  ai: 'AI/ML',
  other: 'Другое',
}

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

const addMonths = (ym: string, n: number): string => {
  if (!ym) return ''
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
  const { companyId } = useParams<{ companyId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('metrics')
  const [showForm, setShowForm] = useState(false)
  const [bulkType, setBulkType] = useState<'plan' | 'fact'>('fact')
  const [bulkStartMonth, setBulkStartMonth] = useState('')
  const [bulkCount, setBulkCount] = useState(3)
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()])
  const [grossMarginPct, setGrossMarginPct] = useState('75')

  const id = companyId ?? ''

  const companyQuery = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id),
    enabled: Boolean(id),
  })

  useEffect(() => {
    const gm = companyQuery.data?.grossMargin
    if (gm != null) setGrossMarginPct(String(Math.round(gm * 100)))
  }, [companyQuery.data?.grossMargin])

  const metricsQuery = useQuery({
    queryKey: ['company-metrics', id],
    queryFn: () => companiesApi.metrics(id),
    enabled: Boolean(id),
  })

  const cohortsQuery = useQuery({
    queryKey: ['company-cohorts', id],
    queryFn: () => companiesApi.cohorts(id),
    enabled: Boolean(id),
  })

  const budgetsQuery = useQuery({
    queryKey: ['company-budgets', id],
    queryFn: () => companiesApi.budgets(id),
    enabled: Boolean(id),
  })

  const unitEconomicsQuery = useQuery({
    queryKey: ['company-unit-economics', id],
    queryFn: () => companiesApi.unitEconomics(id),
    enabled: Boolean(id),
  })

  const tasksQuery = useQuery({
    queryKey: ['company-tasks', id],
    queryFn: () => companiesApi.tasks(id),
    enabled: Boolean(id),
  })

  const readinessQuery = useQuery({
    queryKey: ['company-readiness', id],
    queryFn: () => companiesApi.readiness(id),
    enabled: Boolean(id),
  })

  const hiringQuery = useQuery({
    queryKey: ['company-hiring', id],
    queryFn: () => hiringApi.plan(id),
    enabled: Boolean(id),
  })

  const hiringSettingsMutation = useMutation({
    mutationFn: (d: HiringSettingsUpsert) => hiringApi.upsertSettings(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-hiring', id] })
    },
  })

  const pnlQuery = useQuery({
    queryKey: ['company-pnl', id],
    queryFn: () => pnlApi.get(id),
    enabled: Boolean(id),
  })

  const cashflowQuery = useQuery({
    queryKey: ['company-cashflow', id],
    queryFn: () => cashflowApi.get(id),
    enabled: Boolean(id),
  })

  const creditQuery = useQuery({
    queryKey: ['company-credit', id],
    queryFn: () => creditApi.forecast(id),
    enabled: Boolean(id),
  })

  const valuationQuery = useQuery({
    queryKey: ['company-valuation', id],
    queryFn: () => valuationApi.get(id),
    enabled: Boolean(id),
  })

  const sensitivityQuery = useQuery({
    queryKey: ['company-sensitivity', id],
    queryFn: () => sensitivityApi.get(id),
    enabled: Boolean(id),
  })

  const recalculateMutation = useMutation({
    mutationFn: () => companiesApi.recalculate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-unit-economics', id] })
      queryClient.invalidateQueries({ queryKey: ['company-pnl', id] })
      queryClient.invalidateQueries({ queryKey: ['company-cashflow', id] })
      queryClient.invalidateQueries({ queryKey: ['company-credit', id] })
      queryClient.invalidateQueries({ queryKey: ['company-valuation', id] })
      queryClient.invalidateQueries({ queryKey: ['company-sensitivity', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const generatePlanMutation = useMutation({
    mutationFn: () => companiesApi.generatePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-metrics', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
      queryClient.invalidateQueries({ queryKey: ['company-metrics', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setShowForm(false)
    },
  })

  const grossMarginMutation = useMutation({
    mutationFn: (value: number) => companiesApi.update(id, { grossMargin: value / 100 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', id] })
    },
  })

  const handleCountChange = (n: number) => {
    setBulkCount(n)
    setBulkRows((prev) => Array.from({ length: n }, (_, i) => prev[i] ?? emptyBulkRow()))
  }

  const updateRow = (i: number, field: keyof BulkRow, value: string) => {
    setBulkRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))
  }

  const handleGrossMarginSave = () => {
    const v = Number(grossMarginPct)
    if (Number.isFinite(v) && v >= 0 && v <= 100) grossMarginMutation.mutate(v)
  }

  const bulkValid = bulkStartMonth !== '' && bulkCount >= 1 && bulkCount <= 12

  const cohortUpsert = useMutation({
    mutationFn: (d: CohortUpsert) => companiesApi.upsertCohort(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-cohorts', id] })
    },
  })

  const budgetUpsert = useMutation({
    mutationFn: (d: BudgetUpsert) => companiesApi.upsertBudget(id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-budgets', id] })
    },
  })

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: ['company-tasks', id] })
    queryClient.invalidateQueries({ queryKey: ['company-readiness', id] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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
          <p className="text-destructive font-medium">Ошибка загрузки компании</p>
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
                : 'Сфера не указана'}{' '}
              · {company?.geography || 'Место нахождение не указано'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
            {recalculateMutation.isPending ? 'Пересчёт...' : 'Принудительный пересчёт'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => generatePlanMutation.mutate()}
            disabled={!canEdit || generatePlanMutation.isPending}
            title={!canEdit ? 'Недостаточно прав' : 'Сгенерировать план метрик на основе фактов'}
          >
            <Sparkles className={`w-4 h-4 mr-2 ${generatePlanMutation.isPending ? 'animate-spin' : ''}`} />
            {generatePlanMutation.isPending ? 'Генерация...' : 'Сгенерировать план AI'}
          </Button>
        </div>
      </div>

      {generatePlanMutation.data && (
        <div className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-2">
          План на {generatePlanMutation.data.metrics.length} мес. сгенерирован ({providerLabel(generatePlanMutation.data.provider)}).
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
          <TabsTrigger value="budget">Бюджет</TabsTrigger>
          <TabsTrigger value="unit">Юнит-экономика</TabsTrigger>
          <TabsTrigger value="tasks">Задачи</TabsTrigger>
          <TabsTrigger value="market">Рынок</TabsTrigger>
          <TabsTrigger value="hiring">Найм</TabsTrigger>
          <TabsTrigger value="pnl">P&amp;L</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="credit">Кредиты</TabsTrigger>
          <TabsTrigger value="valuation">Оценка</TabsTrigger>
          <TabsTrigger value="sensitivity">Чувствительность</TabsTrigger>
          <TabsTrigger value="reports">Отчёты</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics">
          <Card className="border bg-card/50">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <h3 className="font-semibold text-foreground">Метрики — План vs Факт</h3>
                <div className="flex flex-wrap items-center gap-3">
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-muted-foreground whitespace-nowrap">
                        Валовая маржа (Gross Margin, %)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        className="w-20"
                        aria-label="Валовая маржа (Gross Margin, %)"
                        value={grossMarginPct}
                        onChange={(e) => setGrossMarginPct(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGrossMarginSave}
                        disabled={grossMarginMutation.isPending}
                      >
                        {grossMarginMutation.isPending ? 'Сохранение...' : 'Сохранить'}
                      </Button>
                    </div>
                  )}
                  {canEdit && (
                    <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Добавить метрику
                    </Button>
                  )}
                </div>
              </div>

              {showForm && canEdit && (
                <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
                  <div className="flex flex-wrap items-end gap-3 mb-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Тип</span>
                      <div className="flex rounded-md border border-input overflow-hidden">
                        {(['plan', 'fact'] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBulkType(t)}
                            className={`h-10 px-4 text-sm font-medium transition-colors ${
                              bulkType === t
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            {t === 'plan' ? 'План' : 'Факт'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Стартовый месяц</span>
                      <Input
                        type="month"
                        aria-label="Стартовый месяц"
                        value={bulkStartMonth}
                        onChange={(e) => setBulkStartMonth(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground">Месяцев</span>
                      <select
                        aria-label="Месяцев"
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
                          <th className="text-left font-medium px-2 py-2">Месяц</th>
                          <th className="text-left font-medium px-2 py-2">Новые юниты</th>
                          <th className="text-left font-medium px-2 py-2">ARPU (₽)</th>
                          <th className="text-left font-medium px-2 py-2">Выручка (₽)</th>
                          <th className="text-left font-medium px-2 py-2">Маркетинг (₽)</th>
                          <th className="text-left font-medium px-2 py-2">Retention %</th>
                          <th className="text-left font-medium px-2 py-2">LTV (₽)</th>
                          <th className="text-left font-medium px-2 py-2">CAC (₽)</th>
                          <th className="text-left font-medium px-2 py-2">Churn %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((r, i) => {
                          const d = deriveMetric(r)
                          return (
                            <tr key={i} className="border-b border-border/50 last:border-0">
                              <td className="px-2 py-2 font-medium text-foreground whitespace-nowrap">
                                {addMonths(bulkStartMonth, i) || '—'}
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={`Новые юниты ${i + 1}`}
                                  value={r.newUnits}
                                  onChange={(e) => updateRow(i, 'newUnits', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={`ARPU ${i + 1}`}
                                  value={r.arpu}
                                  onChange={(e) => updateRow(i, 'arpu', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={`Выручка ${i + 1}`}
                                  value={r.revenue}
                                  onChange={(e) => updateRow(i, 'revenue', e.target.value)}
                                />
                              </td>
                              <td className="px-2 py-2">
                                <Input
                                  type="number"
                                  min="0"
                                  aria-label={`Маркетинг ${i + 1}`}
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
                                  aria-label={`Retention % ${i + 1}`}
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

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={!bulkValid || bulkMutation.isPending}
                      onClick={() => bulkMutation.mutate()}
                    >
                      {bulkMutation.isPending ? 'Сохранение...' : 'Сохранить метрики'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                      Отмена
                    </Button>
                  </div>
                </div>
              )}

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="text-left font-medium px-4 py-3">Период</th>
                    <th className="text-left font-medium px-4 py-3">Выручка план</th>
                    <th className="text-left font-medium px-4 py-3">Выручка факт</th>
                    <th className="text-left font-medium px-4 py-3">Отклонение</th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                      Новые юниты факт
                    </th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                      Retention факт
                    </th>
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
                      </tr>
                    )
                  })}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        Метрики ещё не добавлены.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts">
          <CohortsTab
            cohorts={cohorts}
            canEdit={canEdit}
            onSubmit={(d) => cohortUpsert.mutate(d)}
            isPending={cohortUpsert.isPending}
          />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetTab
            budgets={budgets}
            canEdit={canEdit}
            onSubmit={(d) => budgetUpsert.mutate(d)}
            isPending={budgetUpsert.isPending}
          />
        </TabsContent>

        <TabsContent value="unit">
          <UnitEconomicsTab
            data={unitEconomics}
            isLoading={unitEconomicsQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="tasks">
          <TasksTab
            tasks={tasks}
            readiness={readiness}
            canEdit={canEdit}
            onCreate={(d) => createTaskMutation.mutate(d)}
            onUpdate={(taskId, d) => updateTaskMutation.mutate({ taskId, data: d })}
            onDelete={(taskId) => deleteTaskMutation.mutate(taskId)}
            isPending={createTaskMutation.isPending}
          />
        </TabsContent>

        <TabsContent value="market">
          <MarketTab
            data={marketMutation.data ?? null}
            isLoading={marketMutation.isPending}
            onAnalyze={(req) => marketMutation.mutate(req)}
          />
        </TabsContent>

        <TabsContent value="hiring">
          <HiringTab
            data={hiringQuery.data}
            isLoading={hiringQuery.isLoading}
            isRefetching={hiringQuery.isFetching}
            isSaving={hiringSettingsMutation.isPending}
            canEdit={canEdit}
            onGenerate={() => hiringQuery.refetch()}
            onSaveSettings={(d) => hiringSettingsMutation.mutate(d)}
          />
        </TabsContent>

        <TabsContent value="pnl">
          <PnLTab data={pnlQuery.data} isLoading={pnlQuery.isLoading} />
        </TabsContent>

        <TabsContent value="cashflow">
          <CashFlowTab
            data={cashflowQuery.data}
            isLoading={cashflowQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="credit">
          <CreditTab data={creditQuery.data} isLoading={creditQuery.isLoading} />
        </TabsContent>

        <TabsContent value="valuation">
          <ValuationTab
            data={valuationQuery.data}
            isLoading={valuationQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="sensitivity">
          <SensitivityTab
            data={sensitivityQuery.data}
            isLoading={sensitivityQuery.isLoading}
          />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsTab companyId={id} />
        </TabsContent>
      </Tabs>

      {scenario && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <AIInsight companyId={id} scenario={scenario} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
