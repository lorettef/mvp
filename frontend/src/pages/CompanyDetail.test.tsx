import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyDetail } from './CompanyDetail'
import { qk } from '@/lib/queryKeys'

const mocks = vi.hoisted(() => ({
  role: 'admin' as string,
  companiesApi: {
    get: vi.fn(),
    metrics: vi.fn(),
    cohorts: vi.fn(),
    budgets: vi.fn(),
    upsertMetric: vi.fn(),
    upsertMetricBulk: vi.fn(),
    deleteMetric: vi.fn(),
    deleteCohort: vi.fn(),
    deleteBudget: vi.fn(),
    update: vi.fn(),
    upsertCohort: vi.fn(),
    upsertBudget: vi.fn(),
    unitEconomics: vi.fn(),
    tasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    readiness: vi.fn(),
    recalculate: vi.fn(),
    generatePlan: vi.fn(),
  },
}))

vi.mock('@/api/companies', () => ({ companiesApi: mocks.companiesApi }))

const catalogApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/catalog', () => ({ catalogApi: catalogApiMock }))

const marketApiMock = vi.hoisted(() => ({
  analyze: vi.fn(),
}))

vi.mock('@/api/market', () => ({ marketApi: marketApiMock }))

const hiringApiMock = vi.hoisted(() => ({
  plan: vi.fn(),
  settings: vi.fn(),
  upsertSettings: vi.fn(),
}))

vi.mock('@/api/hiring', () => ({ hiringApi: hiringApiMock }))

const pnlApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/pnl', () => ({ pnlApi: pnlApiMock }))

const cashflowApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/cashflow', () => ({ cashflowApi: cashflowApiMock }))

const creditApiMock = vi.hoisted(() => ({
  forecast: vi.fn(),
}))

vi.mock('@/api/credit', () => ({ creditApi: creditApiMock }))

const valuationApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/valuation', () => ({ valuationApi: valuationApiMock }))

const sensitivityApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/sensitivity', () => ({ sensitivityApi: sensitivityApiMock }))

vi.mock('@/store/authStore', () => {
  const buildState = () => ({
    user: {
      id: 'u1',
      email: 'a@b.c',
      fullName: 'Admin',
      companyName: 'C',
      role: mocks.role,
      organizationId: 'org1',
      companyId: 'comp1',
      subscriptionPlan: 'pro',
      dailyLimit: 10,
      usedToday: 0,
    },
  })
  // Мок должен поддерживать и hook-вызов, и getState() для getTenantKey().
  const useAuthStore = Object.assign(buildState, { getState: buildState })
  return { useAuthStore }
})

const company = {
  id: 'comp1',
  organizationId: 'org1',
  name: 'Test Startup',
  industry: 'saas',
  businessModel: 'subscription',
  geography: 'RU',
  grossMargin: 0.75,
  selectedMetrics: ['new_units', 'arpu', 'revenue', 'marketing_spend', 'retention_rate'],
  archivedAt: null,
  createdAt: '',
}

const catalogData = {
  industries: [{ slug: 'saas', label: 'SaaS' }],
  business_models: [{ slug: 'subscription', label: 'Подписка (SaaS)', description: '' }],
  profiles: {
    saas: {
      subscription: {
        label: 'SaaS-подписка',
        why: '',
        metrics: [
          { key: 'new_units', label: 'Новые платящие клиенты', required: true, why: '' },
          { key: 'arpu', label: 'Средняя выручка на клиента', required: true, why: '' },
          { key: 'revenue', label: 'Выручка (Revenue)', required: true, why: '' },
          { key: 'marketing_spend', label: 'Расходы на привлечение', required: true, why: '' },
          { key: 'retention_rate', label: 'Удержание подписчиков', required: true, why: '' },
        ],
        derived: ['churn', 'ltv', 'cac'],
      },
    },
  },
}

const metric = {
  id: 'm1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  newUnits: 45,
  arpu: 950,
  revenue: 100000,
  marketingSpend: 14400,
  retentionRate: 0.95,
  churn: 0.05,
  ltv: 19000,
  cac: 320,
  activeUnits: 180,
  comment: null,
  createdAt: '',
  updatedAt: '',
}

const cohort = {
  id: 'c1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  size: 100,
  retentionM1: 0.8,
  retentionM2: 0.72,
  retentionM3: 0.6,
  retentionM4: 0.55,
  retentionM5: 0.52,
  retentionM6: 0.5,
  retentionM7: 0.48,
  retentionM8: 0.46,
  retentionM9: 0.44,
  retentionM10: 0.42,
  retentionM11: 0.41,
  retentionM12: 0.4,
  marketingSpend: 50000,
  createdAt: '',
  updatedAt: '',
}

const budget = {
  id: 'b1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  marketing: 100000,
  development: 200000,
  fot: 300000,
  gna: 50000,
  createdAt: '',
  updatedAt: '',
}

const unitEconomicsData = {
  companyId: 'comp1',
  sourceMetric: { id: 'unit-source', period: '2026-02-01', type: 'fact', newUnits: 10,
    arpu: 150, revenue: 120000, marketingSpend: 10000, retentionRate: 0.97, comment: 'Keep comment' },
  revenue: 120000,
  cac: 1000,
  ltv: 5000,
  churn: 0.03,
  ltvCac: 5.0,
  runwayMonths: 15.0,
  paybackPeriod: 4.2,
  romi: 3.0,
  cash: 300000,
  monthlyBurn: 20000,
  magicNumber: 3.5,
  revenueGrowth: 20000,
  marketingSpend: 4000,
  retention: { m1: 0.8, m3: 0.6, m6: 0.5, m12: 0.4 },
  alerts: ['✅ LTV/CAC = 5.00 — отличный показатель.'],
}

const taskData = {
  id: 't1',
  companyId: 'comp1',
  title: 'Подготовить метрики',
  description: null,
  stage: 'metrics',
  status: 'pending',
  effectiveStatus: 'pending',
  dueDate: null,
  createdAt: '',
  updatedAt: '',
}

const readinessData = {
  companyId: 'comp1',
  readiness: 0,
  totalTasks: 1,
  doneTasks: 0,
  stages: [
    { stage: 'metrics', label: 'Подготовка метрик', total: 1, done: 0, percent: 0 },
  ],
  risks: ['Подготовка метрик'],
  summary: 'Готовность 0%. Основные риски: не завершены этапы Подготовка метрик.',
}

const marketData = {
  industry: 'saas',
  industryLabel: 'SaaS',
  geography: 'RU',
  geographyLabel: 'Россия',
  horizon: 3,
  macro: { gdpGrowth: 3.5, inflation: 8.5, keyRate: 21.0 },
  marketSize: 300,
  marketSizeProjected: 456.3,
  marketGrowth: 15,
  trends: ['Сдвиг к AI-функциям'],
  impact: { mrrFactor: 1.01, cacFactor: 1.09, churnFactor: 1.04 },
  summary: 'SaaS в географии «Россия».',
}

const hiringPlanData = {
  companyId: 'comp1',
  forecastStart: '2026-09-01',
  settings: {
    companyId: 'comp1',
    ndflRate: 0.13,
    insuranceRate: 0.3,
    injuryRate: 0.002,
    totalRate: 0.432,
    employerRate: 0.302,
  },
  team: [{ roleKey: 'backend', headcount: 1, salary: 150000 }],
  months: [
    {
      period: '2026-09-01',
      roles: [
        {
          roleKey: 'backend',
          label: 'Backend',
          group: 'engineering',
          requiredHeadcount: 2,
          recommendedHires: 1,
          approvedHires: 0,
          salary: 150000,
          employerCost: 45300,
        },
      ],
      totalRequired: 2,
      totalApproved: 0,
      payroll: 300000,
    },
  ],
  finalHeadcount: 2,
  summary: 'Целевой штат через 12 мес.',
}

const pnlFact = {
  metricSource: { ...unitEconomicsData.sourceMetric, id: 'pnl-metric', revenue: 100000 },
  budgetSource: { id: 'pnl-budget', period: '2026-02-01', type: 'fact', fot: 30000, marketing: 10000, development: 20000, gna: 5000 },
  revenue: 100000, fot: 30000, socialPayments: 9060, marketing: 10000, development: 20000, gna: 5000,
  totalOpex: 74060, ebitda: 25940, financialExpenses: 0, netProfit: 25940, ebitdaMargin: 0.2594, netMargin: 0.2594,
}
const pnlData = {
  periods: [{ period: '2026-02-01', plan: null, fact: pnlFact }],
  companyId: 'comp1',
  period: '2026-02-01',
  mrr: 100000,
  oneTimeRevenue: 0,
  revenue: 100000,
  fot: 30000,
  socialPayments: 12960,
  marketing: 10000,
  development: 20000,
  gna: 5000,
  totalOpex: 77960,
  ebitda: 22040,
  financialExpenses: 15000,
  netProfit: 7040,
  ebitdaMargin: 0.2204,
  netMargin: 0.0704,
  summary: 'EBITDA = 22 040 ₽.',
  months: [],
}

const cashflowData = {
  companyId: 'comp1',
  period: '2026-02-01',
  netProfit: 7040,
  amortization: 0,
  operatingCf: 7040,
  capex: 0,
  investingCf: 0,
  investments: 200000,
  credits: 100000,
  financingCf: 300000,
  totalCf: 307040,
  openingBalance: 0,
  closingBalance: 307040,
  summary: 'Операционный CF = 7 040 ₽.',
  months: [],
}

const creditData = {
  companyId: 'comp1',
  geography: 'RU',
  keyRate: 21,
  creditRate: 26,
  openingCash: 100000,
  baseRevenue: 50000,
  baseOpex: 77960,
  months: [],
  gaps: [],
  totalCreditNeeded: 0,
  summary: 'Кассовых разрывов не прогнозируется.',
}

const valuationData = {
  companyId: 'comp1',
  geography: 'RU',
  keyRate: 21,
  discountRate: 31,
  growthRate: 8.5,
  fcf: 7040,
  terminalValue: 33948.44,
  debt: 100000,
  cash: 200000,
  netDebt: -100000,
  equityValue: 133948.44,
  revenueAnnual: 1200000,
  psRatio: 0.11,
  headcount: 1,
  valuePerEmployee: 133948.44,
  summary: 'Оценка (Equity Value) = 133 948 ₽.',
}

const sensitivityData = {
  companyId: 'comp1',
  geography: 'RU',
  keyRate: 21,
  discountRate: 31,
  base: {
    equityValue: 1000000,
    terminalValue: 500000,
    fcf: 107040,
    growthRate: 8.5,
    mrr: 200000,
    cac: 1000,
    ltv: 5000,
    churn: 0.035,
    ltvCac: 5.0,
  },
  conservative: {
    equityValue: 800000,
    terminalValue: 400000,
    fcf: 86040,
    growthRate: 7.8,
    mrr: 180000,
    cac: 1100,
    ltv: 4750,
    churn: 0.0385,
    ltvCac: 4.32,
  },
  equityDelta: -200000,
  equityDeltaPct: -20.0,
  stresses: [
    { name: 'revenue', equityValue: 800000, equityDelta: -200000, equityDeltaPct: -20.0 },
    { name: 'combined', equityValue: 800000, equityDelta: -200000, equityDeltaPct: -20.0 },
  ],
  summary: 'Консервативный сценарий снижает оценку.',
}

const planGenerateData = {
  companyId: 'comp1',
  provider: 'demo',
  summary: 'Демо-план: рост выручки 5% в месяц.',
  metrics: [
    {
      period: '2026-03-01',
      newUnits: 50,
      arpu: 950,
      revenue: 126000,
      marketingSpend: 15750,
      retentionRate: 0.96,
    },
    {
      period: '2026-04-01',
      newUnits: 52,
      arpu: 960,
      revenue: 132300,
      marketingSpend: 16200,
      retentionRate: 0.96,
    },
  ],
}

function renderCompanyDetail(tab?: string, providedClient?: QueryClient) {
  const queryClient = providedClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const entry = tab ? `/companies/comp1?tab=${tab}` : '/companies/comp1'
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Link to="/companies/comp1?tab=pnl">Open P&amp;L</Link>
        <Routes>
          <Route path="/companies/:companyId" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CompanyDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = 'admin'
    mocks.companiesApi.get.mockResolvedValue(company)
    mocks.companiesApi.metrics.mockResolvedValue([metric])
    mocks.companiesApi.cohorts.mockResolvedValue([cohort])
    mocks.companiesApi.budgets.mockResolvedValue([budget])
    mocks.companiesApi.unitEconomics.mockResolvedValue(unitEconomicsData)
    mocks.companiesApi.tasks.mockResolvedValue([taskData])
    mocks.companiesApi.readiness.mockResolvedValue(readinessData)
    marketApiMock.analyze.mockResolvedValue(marketData)
    hiringApiMock.plan.mockResolvedValue(hiringPlanData)
    hiringApiMock.upsertSettings.mockResolvedValue(hiringPlanData.settings)
    pnlApiMock.get.mockResolvedValue(pnlData)
    cashflowApiMock.get.mockResolvedValue(cashflowData)
    creditApiMock.forecast.mockResolvedValue(creditData)
    valuationApiMock.get.mockResolvedValue(valuationData)
    sensitivityApiMock.get.mockResolvedValue(sensitivityData)
    mocks.companiesApi.generatePlan.mockResolvedValue(planGenerateData)
    mocks.companiesApi.deleteMetric.mockResolvedValue(undefined)
    mocks.companiesApi.deleteCohort.mockResolvedValue(undefined)
    mocks.companiesApi.deleteBudget.mockResolvedValue(undefined)
    catalogApiMock.get.mockResolvedValue(catalogData)
  })

  it.each(['admin', 'company'])('lets %s edit the server-selected metric and invalidates only the current tenant', async (role) => {
    mocks.role = role
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const metricsKey = qk.companyMetrics('org1', 'comp1')
    const dashboardKey = qk.dashboard('org1', { industries: ['saas'] })
    const otherCompanyKey = qk.companyMetrics('other-org', 'comp1')
    const otherDashboardKey = qk.dashboard('other-org')
    for (const key of [metricsKey, dashboardKey, otherCompanyKey, otherDashboardKey]) queryClient.setQueryData(key, [])
    const updated = { ...unitEconomicsData, cac: 250, ltvCac: 20 }
    mocks.companiesApi.unitEconomics.mockResolvedValueOnce(unitEconomicsData).mockResolvedValue(updated)
    mocks.companiesApi.upsertMetric.mockResolvedValue({ ...metric, id: 'unit-source' })
    renderCompanyDetail('unit', queryClient)
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать исходные данные' }))
    const dialog = screen.getByRole('dialog', { name: 'Редактировать исходные данные' })
    expect(within(dialog).getByRole('spinbutton', { name: 'Новые платящие клиенты' })).toHaveValue(10)
    expect(within(dialog).getByRole('spinbutton', { name: 'Расходы на привлечение' })).toHaveValue(10000)
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Удержание подписчиков (%)' }), { target: { value: '82' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledWith('comp1', {
      period: '2026-02-01', type: 'fact', new_units: 10, arpu: 150, revenue: 120000,
      marketing_spend: 10000, retention_rate: 0.82, comment: 'Keep comment',
    })
    expect(await screen.findByText('20.00')).toBeInTheDocument()
    expect(mocks.companiesApi.metrics).not.toHaveBeenCalled()
    expect(queryClient.getQueryState(metricsKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(dashboardKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(otherCompanyKey)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(otherDashboardKey)?.isInvalidated).toBe(false)
  })

  it('deletes the selected source id and refreshes the view without keeping deleted values', async () => {
    mocks.companiesApi.unitEconomics.mockResolvedValueOnce(unitEconomicsData).mockResolvedValue({
      ...unitEconomicsData, sourceMetric: null, revenue: null, cac: null, ltv: null, churn: null, ltvCac: null,
    })
    renderCompanyDetail('unit')
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать исходные данные' }))
    fireEvent.click(screen.getByRole('button', { name: 'Удалить исходную запись' }))
    const dialog = screen.getByRole('dialog', { name: 'Удалить данные за Февраль 2026?' })
    expect(mocks.companiesApi.deleteMetric).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'unit-source')
    expect(screen.queryByRole('button', { name: 'Редактировать исходные данные' })).not.toBeInTheDocument()
    expect(screen.queryByText('5.00')).not.toBeInTheDocument()
  })

  it('does not expose source editing for an observer in the actual container', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('unit')
    await screen.findByText('Источник: Факт · Февраль 2026')
    expect(screen.queryByRole('button', { name: /редактировать исходные данные/i })).not.toBeInTheDocument()
  })

  it('keeps source editor open when the metrics API rejects save', async () => {
    mocks.companiesApi.upsertMetric.mockRejectedValue({ response: { data: { detail: 'Access denied' } } })
    renderCompanyDetail('unit')
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать исходные данные' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить исходные данные: Access denied')
    expect(screen.getByRole('dialog', { name: 'Редактировать исходные данные' })).toBeInTheDocument()
  })

  it.each(['metric-save', 'metric-delete', 'budget-save', 'budget-delete'])('P&L %s uses source API and invalidates all dependents only in the current tenant', async (action) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const keys = [qk.companyMetrics, qk.companyBudgets, qk.companyUnitEconomics, qk.companyCashflow, qk.companyCredit, qk.companyValuation, qk.companySensitivity]
      .map((factory) => factory('org1', 'comp1'))
    keys.push(qk.dashboard('org1', { industries: ['saas'] }), qk.dashboardPerformance('org1'))
    const otherKeys = [qk.companyMetrics('other-org', 'comp1'), qk.dashboard('other-org')]
    for (const key of [...keys, ...otherKeys]) qc.setQueryData(key, [])
    const isMetric = action.startsWith('metric')
    const deleting = action.endsWith('delete')
    const updated = { ...pnlData, periods: [{ period: '2026-02-01', plan: null, fact: { ...pnlFact,
      revenue: isMetric ? (deleting ? null : 200000) : 100000,
      fot: isMetric ? 30000 : (deleting ? null : 40000),
      ebitda: deleting ? null : 112920,
      metricSource: isMetric && deleting ? null : pnlFact.metricSource,
      budgetSource: !isMetric && deleting ? null : pnlFact.budgetSource,
    } }] }
    pnlApiMock.get.mockResolvedValueOnce(pnlData).mockResolvedValue(updated)
    mocks.companiesApi.upsertMetric.mockResolvedValue({})
    mocks.companiesApi.upsertBudget.mockResolvedValue({})
    renderCompanyDetail('pnl', qc)
    const table = await screen.findByRole('table', { name: 'P&L: месяцы, план и факт' })
    fireEvent.doubleClick(within(table).getByRole('button', { name: new RegExp(`^${isMetric ? 'Выручка' : 'ФОТ'} · .* · Факт —`) }))
    let editor = screen.getByRole('dialog')
    if (deleting) {
      fireEvent.click(within(editor).getByRole('button', { name: 'Удалить исходную запись' }))
      editor = screen.getByRole('dialog')
      fireEvent.click(within(editor).getByRole('button', { name: 'Удалить' }))
    } else {
      fireEvent.change(within(editor).getByRole('spinbutton', { name: isMetric ? 'Выручка (Revenue)' : 'ФОТ' }), { target: { value: isMetric ? '200000' : '40000' } })
      fireEvent.click(within(editor).getByRole('button', { name: 'Сохранить' }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    if (deleting) expect(isMetric ? mocks.companiesApi.deleteMetric : mocks.companiesApi.deleteBudget).toHaveBeenCalledWith('comp1', isMetric ? 'pnl-metric' : 'pnl-budget')
    else if (isMetric) expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledWith('comp1', { period: '2026-02-01', type: 'fact', new_units: 10, arpu: 150, revenue: 200000, marketing_spend: 10000, retention_rate: 0.97, comment: 'Keep comment' })
    else expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledWith('comp1', { period: '2026-02-01', type: 'fact', fot: 40000, marketing: 10000, development: 20000, gna: 5000 })
    expect(pnlApiMock.get).toHaveBeenCalledTimes(2)
    expect(mocks.companiesApi.metrics).not.toHaveBeenCalled()
    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    for (const key of keys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
    for (const key of otherKeys) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    if (!deleting) expect(within(table).getByText('₽112 920')).toBeInTheDocument()
  })

  it('P&L is read-only for observer in the actual page', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('pnl')
    await screen.findByRole('table', { name: 'P&L: месяцы, план и факт' })
    expect(screen.queryByRole('button', { name: /редактировать исходную запись/ })).not.toBeInTheDocument()
  })

  it('shows metrics tab by default', async () => {
    renderCompanyDetail()
    expect(await screen.findByText('Метрики — План vs Факт')).toBeInTheDocument()
    expect(screen.queryByText('Когортный анализ — План vs Факт')).not.toBeInTheDocument()
  })

  it('has no force-recalculation action on the company page', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(screen.queryByRole('button', { name: /Принудительн/ })).not.toBeInTheDocument()
    expect(mocks.companiesApi.recalculate).not.toHaveBeenCalled()
  })

  it.each(['bulk-save', 'delete', 'generate-plan'])('Metrics %s invalidates all financial consumers and only the current tenant', async (action) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const keys = [qk.companyUnitEconomics, qk.companyPnl, qk.companyCashflow, qk.companyCredit, qk.companyValuation, qk.companySensitivity]
      .map((factory) => factory('org1', 'comp1'))
    keys.push(qk.dashboard('org1'), qk.dashboardPerformance('org1'))
    const other = qk.companyPnl('other-org', 'comp1')
    for (const key of [...keys, other]) qc.setQueryData(key, [])
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([metric])
    renderCompanyDetail('metrics', qc)
    await screen.findByText('Метрики — План vs Факт')
    if (action === 'delete') {
      fireEvent.click(await screen.findByRole('button', { name: 'Удалить метрику' }))
      fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
      await waitFor(() => expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'm1'))
    } else if (action === 'generate-plan') {
      fireEvent.click(screen.getByRole('button', { name: 'Сгенерировать план AI' }))
      await waitFor(() => expect(mocks.companiesApi.generatePlan).toHaveBeenCalledWith('comp1'))
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Добавить метрику' }))
      for (const index of [1, 2, 3]) for (const [name, value] of [['Выручка', '100000'], ['Новые юниты', '10'], ['ARPU', '100'], ['Retention %', '90']]) {
        fireEvent.change(screen.getByLabelText(`${name} ${index}`), { target: { value } })
      }
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))
      await waitFor(() => expect(mocks.companiesApi.upsertMetricBulk).toHaveBeenCalled())
    }
    await waitFor(() => { for (const key of keys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true) })
    expect(qc.getQueryState(other)?.isInvalidated).toBe(false)
  })

  it('relabels metric columns by company industry and business model', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')

    expect(await screen.findByText('Выручка (Revenue) · План')).toBeInTheDocument()
    expect(screen.getByText('Выручка (Revenue) · Факт')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Добавить метрику' }))
    expect(await screen.findByText('Средняя выручка на клиента')).toBeInTheDocument()
    expect(screen.getByText('Расходы на привлечение')).toBeInTheDocument()
    expect(screen.getAllByText('Новые платящие клиенты').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Удержание подписчиков').length).toBeGreaterThan(0)
  })

  it('fetches only the company and active-tab queries on mount', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')

    await waitFor(() => expect(mocks.companiesApi.get).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(1))

    expect(mocks.companiesApi.cohorts).not.toHaveBeenCalled()
    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    expect(mocks.companiesApi.unitEconomics).not.toHaveBeenCalled()
    expect(mocks.companiesApi.tasks).not.toHaveBeenCalled()
    expect(mocks.companiesApi.readiness).not.toHaveBeenCalled()
    expect(hiringApiMock.plan).not.toHaveBeenCalled()
    expect(pnlApiMock.get).not.toHaveBeenCalled()
    expect(cashflowApiMock.get).not.toHaveBeenCalled()
    expect(creditApiMock.forecast).not.toHaveBeenCalled()
    expect(valuationApiMock.get).not.toHaveBeenCalled()
    expect(sensitivityApiMock.get).not.toHaveBeenCalled()
    expect(marketApiMock.analyze).not.toHaveBeenCalled()
  })

  it('forwards React Query AbortSignal to the api functions', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')

    await waitFor(() => expect(mocks.companiesApi.get).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(1))

    const getCall = mocks.companiesApi.get.mock.calls[0]
    expect(getCall[0]).toBe('comp1')
    expect(getCall[1].signal).toBeInstanceOf(AbortSignal)

    const metricsCall = mocks.companiesApi.metrics.mock.calls[0]
    expect(metricsCall[0]).toBe('comp1')
    expect(metricsCall[2].signal).toBeInstanceOf(AbortSignal)
  })

  it('defers non-active tab queries', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(mocks.companiesApi.cohorts).not.toHaveBeenCalled()
    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    expect(mocks.companiesApi.unitEconomics).not.toHaveBeenCalled()
  })

  it('renders cohorts content for ?tab=cohorts', async () => {
    renderCompanyDetail('cohorts')
    expect(await screen.findByText('Когортный анализ — матрица удержания M1–M12')).toBeInTheDocument()
  })

  it('renders budget content for ?tab=budget', async () => {
    renderCompanyDetail('budget')
    expect(await screen.findByText('Бюджет — План vs Факт')).toBeInTheDocument()
  })

  it.each(['create', 'update', 'delete'])('Budget %s refreshes server values and the paired P&L with tenant-scoped invalidation', async (action) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const dependentKeys = [qk.companyMetrics, qk.companyUnitEconomics, qk.companyCashflow, qk.companyCredit, qk.companyValuation, qk.companySensitivity]
      .map((factory) => factory('org1', 'comp1'))
    dependentKeys.push(qk.dashboard('org1'), qk.dashboardPerformance('org1'))
    const otherKeys = [qk.companyBudgets('other-org', 'comp1'), qk.dashboard('other-org')]
    for (const key of [...dependentKeys, ...otherKeys]) qc.setQueryData(key, [])
    const source = { ...budget, period: '2026-02-01', fot: 30000, marketing: 10000, development: 20000, gna: 5000 }
    const factBudget = { ...source, id: 'fact-budget', type: 'fact' }
    const planBefore = { ...pnlFact, budgetSource: source, fot: 30000 }
    qc.setQueryData(qk.companyPnl('org1', 'comp1'), { ...pnlData, periods: [{ period: source.period, plan: planBefore, fact: pnlFact }] })
    const after = action === 'delete' ? null : { ...source, fot: 40000 }
    const planAfter = { ...planBefore, budgetSource: after, fot: after?.fot ?? null, ebitda: action === 'delete' ? null : 112920 }
    pnlApiMock.get.mockResolvedValue({ ...pnlData, periods: [{ period: source.period, plan: planAfter, fact: pnlFact }] })
    mocks.companiesApi.budgets.mockResolvedValueOnce(action === 'create' ? [factBudget] : [source, factBudget])
      .mockResolvedValue(after ? [after, factBudget] : [factBudget])
    mocks.companiesApi.upsertBudget.mockResolvedValue(after)
    renderCompanyDetail('budget', qc)
    const table = await screen.findByRole('table', { name: 'Бюджет: месяцы, план и факт' })
    fireEvent.doubleClick(within(table).getByRole('button', { name: /^ФОТ · .* · План —/ }))
    if (action === 'delete') {
      fireEvent.click(screen.getByRole('button', { name: 'Удалить исходную запись' }))
      fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    } else {
      for (const [name, value] of [['Маркетинг', '10000'], ['Разработка', '20000'], ['ФОТ', '40000'], ['G&A', '5000']]) {
        fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } })
      }
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    if (action === 'delete') expect(mocks.companiesApi.deleteBudget).toHaveBeenCalledWith('comp1', 'b1')
    else expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledWith('comp1', { period: source.period, type: 'plan', fot: 40000, marketing: 10000, development: 20000, gna: 5000 })
    expect(mocks.companiesApi.budgets).toHaveBeenCalledTimes(2)
    expect(within(table).getByRole('button', { name: /^ФОТ · .* · План —/ })).toHaveTextContent(action === 'delete' ? '—' : '₽40 000')
    for (const key of dependentKeys) expect(qc.getQueryState(key)?.isInvalidated).toBe(true)
    for (const key of otherKeys) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    expect(qc.getQueryState(qk.companyPnl('org1', 'comp1'))?.isInvalidated).toBe(true)
    fireEvent.click(screen.getByRole('link', { name: 'Open P&L' }))
    const pnl = await screen.findByRole('table', { name: 'P&L: месяцы, план и факт' })
    await waitFor(() => expect(within(pnl).getByRole('button', { name: /^ФОТ · .* · План —/ })).toHaveTextContent(action === 'delete' ? '—' : '₽40 000'))
    expect(within(pnl).getByRole('button', { name: /^ФОТ · .* · Факт —/ })).toHaveTextContent('₽30 000')
    expect(pnlApiMock.get).toHaveBeenCalledTimes(1)
  })

  it('Budget is read-only for observer in the actual company page', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('budget')
    const table = await screen.findByRole('table', { name: 'Бюджет: месяцы, план и факт' })
    expect(within(table).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Добавить бюджет' })).not.toBeInTheDocument()
    fireEvent.doubleClick(within(table).getAllByRole('cell')[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders unit economics content for ?tab=unit', async () => {
    renderCompanyDetail('unit')
    expect(await screen.findByText('Соотношение LTV/CAC')).toBeInTheDocument()
    expect(screen.getByText('Magic Number')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()
  })

  it('renders tasks content for ?tab=tasks', async () => {
    renderCompanyDetail('tasks')
    expect(await screen.findByText('Готовность к продаже')).toBeInTheDocument()
    expect(screen.getByText('Подготовить метрики')).toBeInTheDocument()
  })

  it('renders market content for ?tab=market', async () => {
    renderCompanyDetail('market')
    expect(await screen.findByText('Внешний анализ рынка')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeInTheDocument()
  })

  it('renders hiring content for ?tab=hiring', async () => {
    renderCompanyDetail('hiring')
    expect(await screen.findByText('Прогноз найма')).toBeInTheDocument()
  })

  it('renders pnl content for ?tab=pnl', async () => {
    renderCompanyDetail('pnl')
    expect(await screen.findByText('P&L — Отчёт о прибылях и убытках')).toBeInTheDocument()
  })

  it('renders cashflow content for ?tab=cashflow', async () => {
    renderCompanyDetail('cashflow')
    expect(await screen.findByText('Cash Flow — Движение денежных средств')).toBeInTheDocument()
  })

  it('renders credit content for ?tab=credit', async () => {
    renderCompanyDetail('credit')
    expect(await screen.findByText('Кассовый разрыв — прогнозирование')).toBeInTheDocument()
  })

  it('renders valuation content for ?tab=valuation', async () => {
    renderCompanyDetail('valuation')
    expect(await screen.findByText('Оценка бизнеса — модель Гордона')).toBeInTheDocument()
  })

  it('renders sensitivity content for ?tab=sensitivity', async () => {
    renderCompanyDetail('sensitivity')
    expect(await screen.findByText('Анализ чувствительности — консервативный сценарий')).toBeInTheDocument()
  })

  it('renders reports content for ?tab=reports', async () => {
    renderCompanyDetail('reports')
    expect(await screen.findByText('Отчёты для инвесторов')).toBeInTheDocument()
  })

  it('generates AI plan on click', async () => {
    renderCompanyDetail()
    const btn = await screen.findByRole('button', { name: /Сгенерировать план AI/ })
    fireEvent.click(btn)
    await waitFor(() => expect(mocks.companiesApi.generatePlan).toHaveBeenCalledWith('comp1'))
  })

  it('hides add buttons for observer role', async () => {
    mocks.role = 'observer'
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(screen.queryByRole('button', { name: /Добавить метрику/ })).not.toBeInTheDocument()
  })

  it('bulk-saves metrics with snake_case payload', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))
    expect(screen.getByRole('columnheader', { name: 'Пожизненная ценность клиента (LTV), ₽' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Стоимость привлечения клиента (CAC), ₽' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Отток клиентов (Churn), %' })).toBeInTheDocument()

    const now = new Date()
    const period = (offset: number) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 2 + offset, 1)
      return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`
    }

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Маркетинг 1'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.change(screen.getByLabelText('Выручка 2'), { target: { value: '6000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 2'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('ARPU 2'), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText('Retention % 2'), { target: { value: '85' } })

    fireEvent.change(screen.getByLabelText('Выручка 3'), { target: { value: '7000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 3'), { target: { value: '14' } })
    fireEvent.change(screen.getByLabelText('ARPU 3'), { target: { value: '700' } })
    fireEvent.change(screen.getByLabelText('Retention % 3'), { target: { value: '80' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    await waitFor(() =>
      expect(mocks.companiesApi.upsertMetricBulk).toHaveBeenCalledWith('comp1', {
        items: [
          {
            period: period(0),
            type: 'fact',
            new_units: 10,
            arpu: 500,
            revenue: 5000,
            marketing_spend: 1000,
            retention_rate: 0.9,
          },
          {
            period: period(1),
            type: 'fact',
            new_units: 12,
            arpu: 600,
            revenue: 6000,
            marketing_spend: 0,
            retention_rate: 0.85,
          },
          {
            period: period(2),
            type: 'fact',
            new_units: 14,
            arpu: 700,
            revenue: 7000,
            marketing_spend: 0,
            retention_rate: 0.8,
          },
        ],
      }),
    )
  })

  it('keeps missing preview inputs distinct from real zero in bulk metrics', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить метрику' })
    const row = within(dialog).getAllByRole('row')[1]
    const preview = () => within(row).getAllByRole('cell').slice(-3).map(cell => cell.textContent?.trim())
    expect(preview()).toEqual(['—', '—', '—'])
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '100' } })
    expect(preview()).toEqual(['—', '—', '0.0%'])
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Маркетинг 1'), { target: { value: '0' } })
    expect(preview()).toEqual(['₽1\u00a0200', '₽0', '0.0%'])
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '' } })
    expect(preview()).toEqual(['—', '₽0', '—'])
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('blocks bulk save when a required field is empty and shows an inline message', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    expect(
      await screen.findByText('Строка 2: поле «Новые платящие клиенты» обязательно и должно быть числом.'),
    ).toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('blocks bulk save when ARPU is empty instead of silently sending 0', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Месяцев'), { target: { value: '1' } })

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    expect(
      await screen.findByText('Строка 1: поле «Средняя выручка на клиента» обязательно и должно быть числом.'),
    ).toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('saves gross margin via update', async () => {
    mocks.companiesApi.update.mockResolvedValue(company)
    renderCompanyDetail()
    const input = await screen.findByLabelText('Валовая маржа (Gross Margin, %)')
    const card = input.closest('.rounded-lg')
    expect(card).toHaveClass('w-fit')
    expect(card?.parentElement?.firstElementChild).toHaveTextContent('Метрики')
    expect(screen.getByRole('button', { name: 'Сохранить' })).toHaveClass('bg-primary/80', 'font-semibold', 'hover:bg-primary')
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() =>
      expect(mocks.companiesApi.update).toHaveBeenCalledWith('comp1', {
        gross_margin: 0.8,
      }),
    )
  })

  it('preserves half percentage points when gross margin loads', async () => {
    mocks.companiesApi.get.mockResolvedValue({ ...company, grossMargin: 0.755 })
    renderCompanyDetail()

    const input = await screen.findByLabelText('Валовая маржа (Gross Margin, %)')
    await waitFor(() => expect(input).toHaveValue(75.5))
  })

  it('confirms metric deletion before calling the delete API', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: 'Удалить метрику' }))

    expect(screen.getByText('Удалить данные?')).toBeInTheDocument()
    expect(mocks.companiesApi.deleteMetric).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() =>
      expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'm1'),
    )
  })
})
