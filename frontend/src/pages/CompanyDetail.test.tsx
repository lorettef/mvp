import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyDetail } from './CompanyDetail'

const mocks = vi.hoisted(() => ({
  role: 'admin' as string,
  companiesApi: {
    get: vi.fn(),
    metrics: vi.fn(),
    cohorts: vi.fn(),
    budgets: vi.fn(),
    upsertMetric: vi.fn(),
    upsertMetricBulk: vi.fn(),
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
  geography: 'RU',
  grossMargin: 0.75,
  createdAt: '',
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
  industry: 'saas',
  industryLabel: 'SaaS',
  baseRevenue: 100000,
  fotShare: 0.35,
  avgSalary: 150000,
  monthlyGrowth: 0.05,
  settings: {
    companyId: 'comp1',
    ndflRate: 0.13,
    insuranceRate: 0.3,
    injuryRate: 0.002,
    totalRate: 0.432,
  },
  months: [
    {
      month: 1,
      period: '2026-09-01',
      revenue: 105000,
      fot: 36750,
      socialPayments: 15876,
      totalCost: 52626,
      headcount: 3,
      devCount: 1,
      salesCount: 1,
      marketingCount: 1,
    },
  ],
  finalHeadcount: 3,
  summary: 'Целевой штат «SaaS» через 12 мес.',
}

const pnlData = {
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
  summary: 'Консервативный сценарий снижает оценку.',
}

const recalculateData = {
  companyId: 'comp1',
  recalculatedAt: '2026-08-23T00:00:00Z',
  revenue: 120000,
  runwayMonths: 15.0,
  ltvCac: 5.0,
  ebitda: 22040,
  netProfit: 7040,
  totalCf: 307040,
  equityValue: 133948.44,
  totalCreditNeeded: 0,
  summary: 'Кассовых разрывов не прогнозируется.',
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

function renderCompanyDetail() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/companies/comp1']}>
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
    mocks.companiesApi.recalculate.mockResolvedValue(recalculateData)
    mocks.companiesApi.generatePlan.mockResolvedValue(planGenerateData)
  })

  it('renders 13 tab triggers', async () => {
    renderCompanyDetail()
    expect(await screen.findByRole('tab', { name: 'Метрики' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Когорты' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Бюджет' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Юнит-экономика' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Задачи' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Рынок' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Найм' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'P&L' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Cash Flow' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Кредиты' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Оценка' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Чувствительность' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Отчёты' })).toBeInTheDocument()
  })

  it('shows metrics tab by default', async () => {
    renderCompanyDetail()
    expect(await screen.findByText('Метрики — План vs Факт')).toBeInTheDocument()
    expect(screen.queryByText('Когортный анализ — План vs Факт')).not.toBeInTheDocument()
  })

  it('fetches only the company and active-tab queries on mount', async () => {
    renderCompanyDetail()
    await screen.findByRole('tab', { name: 'Метрики' })

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
    await screen.findByRole('tab', { name: 'Метрики' })

    await waitFor(() => expect(mocks.companiesApi.get).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(1))

    const getCall = mocks.companiesApi.get.mock.calls[0]
    expect(getCall[0]).toBe('comp1')
    expect(getCall[1].signal).toBeInstanceOf(AbortSignal)

    const metricsCall = mocks.companiesApi.metrics.mock.calls[0]
    expect(metricsCall[0]).toBe('comp1')
    expect(metricsCall[2].signal).toBeInstanceOf(AbortSignal)
  })

  it('defers a tab query until its tab becomes active', async () => {
    renderCompanyDetail()
    await screen.findByRole('tab', { name: 'Метрики' })

    expect(mocks.companiesApi.cohorts).not.toHaveBeenCalled()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Когорты' }))
    await waitFor(() => expect(mocks.companiesApi.cohorts).toHaveBeenCalledTimes(1))

    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    expect(mocks.companiesApi.unitEconomics).not.toHaveBeenCalled()
  })

  it('switches to cohorts tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Когорты' }))
    expect(await screen.findByText('Когортный анализ — матрица удержания M1–M12')).toBeInTheDocument()
  })

  it('switches to budget tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Бюджет' }))
    expect(await screen.findByText('Бюджет — План vs Факт')).toBeInTheDocument()
  })

  it('switches to unit economics tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Юнит-экономика' }))
    expect(await screen.findByText('LTV/CAC')).toBeInTheDocument()
    expect(screen.getByText('Magic Number')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()
  })

  it('switches to tasks tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Задачи' }))
    expect(await screen.findByText('Готовность к продаже')).toBeInTheDocument()
    expect(screen.getByText('Подготовить метрики')).toBeInTheDocument()
  })

  it('switches to market tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Рынок' }))
    expect(await screen.findByText('Внешний анализ рынка')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeInTheDocument()
  })

  it('switches to hiring tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Найм' }))
    expect(await screen.findByText('Прогноз найма')).toBeInTheDocument()
  })

  it('switches to pnl tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'P&L' }))
    expect(
      await screen.findByText('P&L — Отчёт о прибылях и убытках'),
    ).toBeInTheDocument()
  })

  it('switches to cashflow tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Cash Flow' }))
    expect(
      await screen.findByText('Cash Flow — Движение денежных средств'),
    ).toBeInTheDocument()
  })

  it('switches to credit tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Кредиты' }))
    expect(
      await screen.findByText('Кредиты — умное прогнозирование'),
    ).toBeInTheDocument()
  })

  it('switches to valuation tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Оценка' }))
    expect(
      await screen.findByText('Оценка бизнеса — модель Гордона'),
    ).toBeInTheDocument()
  })

  it('switches to sensitivity tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Чувствительность' }))
    expect(
      await screen.findByText('Анализ чувствительности — консервативный сценарий'),
    ).toBeInTheDocument()
  })

  it('switches to reports tab on click', async () => {
    renderCompanyDetail()
    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Отчёты' }))
    expect(await screen.findByText('Отчёты для инвесторов')).toBeInTheDocument()
  })

  it('triggers forced recalculation on click', async () => {
    renderCompanyDetail()
    const btn = await screen.findByRole('button', { name: /Принудительный пересчёт/ })
    fireEvent.click(btn)
    await waitFor(() => expect(mocks.companiesApi.recalculate).toHaveBeenCalledWith('comp1'))
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
    await screen.findByRole('tab', { name: 'Метрики' })
    expect(screen.queryByRole('button', { name: /Добавить метрику/ })).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Когорты' }))
    expect(screen.queryByRole('button', { name: /Добавить когорту/ })).not.toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Бюджет' }))
    expect(screen.queryByRole('button', { name: /Добавить бюджет/ })).not.toBeInTheDocument()
  })

  it('bulk-saves metrics with snake_case payload', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Стартовый месяц'), {
      target: { value: '2026-01' },
    })
    fireEvent.change(screen.getByLabelText('Месяцев'), { target: { value: '2' } })

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Маркетинг 1'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.change(screen.getByLabelText('Выручка 2'), { target: { value: '6000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 2'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('ARPU 2'), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText('Retention % 2'), { target: { value: '85' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    await waitFor(() =>
      expect(mocks.companiesApi.upsertMetricBulk).toHaveBeenCalledWith('comp1', {
        items: [
          {
            period: '2026-01-01',
            type: 'fact',
            new_units: 10,
            arpu: 500,
            revenue: 5000,
            marketing_spend: 1000,
            retention_rate: 0.9,
          },
          {
            period: '2026-02-01',
            type: 'fact',
            new_units: 12,
            arpu: 600,
            revenue: 6000,
            marketing_spend: 0,
            retention_rate: 0.85,
          },
        ],
      }),
    )
  })

  it('blocks bulk save when a required field is empty and shows an inline message', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Стартовый месяц'), {
      target: { value: '2026-01' },
    })
    fireEvent.change(screen.getByLabelText('Месяцев'), { target: { value: '2' } })

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    expect(
      await screen.findByText('Строка 2: поле «Новые юниты» обязательно и должно быть числом.'),
    ).toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('blocks bulk save when ARPU is empty instead of silently sending 0', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Стартовый месяц'), {
      target: { value: '2026-01' },
    })
    fireEvent.change(screen.getByLabelText('Месяцев'), { target: { value: '1' } })

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    expect(
      await screen.findByText('Строка 1: поле «ARPU» обязательно и должно быть числом.'),
    ).toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('saves gross margin via update', async () => {
    mocks.companiesApi.update.mockResolvedValue(company)
    renderCompanyDetail()
    const input = await screen.findByLabelText('Валовая маржа (Gross Margin, %)')
    fireEvent.change(input, { target: { value: '80' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() =>
      expect(mocks.companiesApi.update).toHaveBeenCalledWith('comp1', {
        gross_margin: 0.8,
      }),
    )
  })
})
