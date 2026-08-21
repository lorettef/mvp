import { render, screen, fireEvent } from '@testing-library/react'
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
    upsertCohort: vi.fn(),
    upsertBudget: vi.fn(),
    unitEconomics: vi.fn(),
    tasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    readiness: vi.fn(),
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

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({
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
  }),
}))

const company = {
  id: 'comp1',
  organizationId: 'org1',
  name: 'Test Startup',
  industry: 'SaaS',
  geography: 'RU',
  createdAt: '',
}

const metric = {
  id: 'm1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  mrr: 100000,
  cac: 50000,
  ltv: 300000,
  churn: 0.05,
  arpu: null,
  runwayMonths: null,
  stage: null,
  createdAt: '',
  updatedAt: '',
}

const cohort = {
  id: 'c1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  retentionM1: 0.8,
  retentionM3: 0.6,
  retentionM6: 0.5,
  retentionM12: 0.4,
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
  mrr: 120000,
  cac: 1000,
  ltv: 5000,
  churn: 0.03,
  ltvCac: 5.0,
  runwayMonths: 15.0,
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
  baseMrr: 100000,
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
      mrr: 105000,
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
  })

  it('renders 11 tab triggers', async () => {
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
  })

  it('shows metrics tab by default', async () => {
    renderCompanyDetail()
    expect(await screen.findByText('Метрики — План vs Факт')).toBeInTheDocument()
    expect(screen.queryByText('Когортный анализ — План vs Факт')).not.toBeInTheDocument()
  })

  it('switches to cohorts tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Когорты' }))
    expect(await screen.findByText('Когортный анализ — План vs Факт')).toBeInTheDocument()
  })

  it('switches to budget tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Бюджет' }))
    expect(await screen.findByText('Бюджет — План vs Факт')).toBeInTheDocument()
  })

  it('switches to unit economics tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Юнит-экономика' }))
    expect(await screen.findByText('LTV/CAC')).toBeInTheDocument()
    expect(screen.getByText('Magic Number')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()
  })

  it('switches to tasks tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Задачи' }))
    expect(await screen.findByText('Готовность к продаже')).toBeInTheDocument()
    expect(screen.getByText('Подготовить метрики')).toBeInTheDocument()
  })

  it('switches to market tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Рынок' }))
    expect(await screen.findByText('Внешний анализ рынка')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeInTheDocument()
  })

  it('switches to hiring tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Найм' }))
    expect(await screen.findByText('Прогноз найма')).toBeInTheDocument()
  })

  it('switches to pnl tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'P&L' }))
    expect(
      await screen.findByText('P&L — Отчёт о прибылях и убытках'),
    ).toBeInTheDocument()
  })

  it('switches to cashflow tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Cash Flow' }))
    expect(
      await screen.findByText('Cash Flow — Движение денежных средств'),
    ).toBeInTheDocument()
  })

  it('switches to credit tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Кредиты' }))
    expect(
      await screen.findByText('Кредиты — умное прогнозирование'),
    ).toBeInTheDocument()
  })

  it('switches to valuation tab on click', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('tab', { name: 'Оценка' }))
    expect(
      await screen.findByText('Оценка бизнеса — модель Гордона'),
    ).toBeInTheDocument()
  })

  it('hides add buttons for observer role', async () => {
    mocks.role = 'observer'
    renderCompanyDetail()
    await screen.findByRole('tab', { name: 'Метрики' })
    expect(screen.queryByRole('button', { name: /Добавить метрику/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Когорты' }))
    expect(screen.queryByRole('button', { name: /Добавить когорту/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Бюджет' }))
    expect(screen.queryByRole('button', { name: /Добавить бюджет/ })).not.toBeInTheDocument()
  })
})
