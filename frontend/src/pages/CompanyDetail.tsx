import { useState } from 'react'
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
import type { Metric, CohortUpsert, BudgetUpsert, TaskCreate, TaskUpdate, MarketAnalysisRequest, HiringSettingsUpsert } from '@/types/api'
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
import { Sparkles, Plus, AlertCircle, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react'

const fmtRub = (v: number | null | undefined) => (v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`)

const fmtPeriod = (period: string) => (period ? period.slice(0, 7) : '—')

const fmtPct = (v: number | null | undefined) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`)

const providerLabel = (p: string) =>
  p === 'deepseek' ? 'DeepSeek' : p === 'gigachat' ? 'GigaChat' : 'демо-режим'

export const CompanyDetail = () => {
  const { companyId } = useParams<{ companyId: string }>()
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('metrics')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    period: '',
    type: 'fact' as 'plan' | 'fact',
    mrr: '',
    cac: '',
    ltv: '',
    churnPct: '',
  })

  const id = companyId ?? ''

  const companyQuery = useQuery({
    queryKey: ['company', id],
    queryFn: () => companiesApi.get(id),
    enabled: Boolean(id),
  })

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

  const upsertMutation = useMutation({
    mutationFn: () =>
      companiesApi.upsertMetric(id, {
        period: `${form.period}-01`,
        type: form.type,
        mrr: Number(form.mrr),
        cac: Number(form.cac),
        ltv: Number(form.ltv),
        churn: Number(form.churnPct) / 100,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-metrics', id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setShowForm(false)
      setForm({ period: '', type: 'fact', mrr: '', cac: '', ltv: '', churnPct: '' })
    },
  })

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
              {company?.industry || 'Сфера не указана'} · {company?.geography || 'География не указана'}
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
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-semibold text-foreground">Метрики — План vs Факт</h3>
                {canEdit && (
                  <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Добавить метрику
                  </Button>
                )}
              </div>

              {showForm && canEdit && (
                <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                    <Input type="month" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} />
                    <select
                      value={form.type}
                      onChange={(e) => setForm({ ...form, type: e.target.value as 'plan' | 'fact' })}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="plan">План</option>
                      <option value="fact">Факт</option>
                    </select>
                    <Input type="number" placeholder="MRR (₽)" value={form.mrr} onChange={(e) => setForm({ ...form, mrr: e.target.value })} />
                    <Input type="number" placeholder="CAC (₽)" value={form.cac} onChange={(e) => setForm({ ...form, cac: e.target.value })} />
                    <Input type="number" placeholder="LTV (₽)" value={form.ltv} onChange={(e) => setForm({ ...form, ltv: e.target.value })} />
                    <Input type="number" step="0.1" placeholder="Churn (%)" value={form.churnPct} onChange={(e) => setForm({ ...form, churnPct: e.target.value })} />
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={!form.period || !form.mrr || !form.cac || !form.ltv || form.churnPct === '' || upsertMutation.isPending}
                      onClick={() => upsertMutation.mutate()}
                    >
                      {upsertMutation.isPending ? 'Сохранение...' : 'Сохранить'}
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
                    <th className="text-left font-medium px-4 py-3">MRR план</th>
                    <th className="text-left font-medium px-4 py-3">MRR факт</th>
                    <th className="text-left font-medium px-4 py-3">Отклонение</th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">CAC факт</th>
                    <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">Churn факт</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([period, entry]) => {
                    const planMrr = entry.plan?.mrr
                    const factMrr = entry.fact?.mrr
                    const dev = planMrr != null && factMrr != null ? factMrr - planMrr : null
                    const devPct = dev != null && planMrr ? (dev / planMrr) * 100 : null
                    const positive = dev != null && dev >= 0
                    return (
                      <tr key={period} className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{fmtPeriod(period)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtRub(planMrr)}</td>
                        <td className="px-4 py-3 text-foreground">{fmtRub(factMrr)}</td>
                        <td className="px-4 py-3">
                          {dev == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 font-medium ${positive ? 'text-emerald-500' : 'text-destructive'}`}>
                              {positive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                              {devPct != null ? `${devPct >= 0 ? '+' : ''}${devPct.toFixed(1)}%` : ''}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{fmtRub(entry.fact?.cac)}</td>
                        <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{fmtPct(entry.fact?.churn)}</td>
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
    </div>
  )
}
