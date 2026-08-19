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
  })

  it('renders 6 tab triggers', async () => {
    renderCompanyDetail()
    expect(await screen.findByRole('tab', { name: 'Метрики' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Когорты' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Бюджет' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Юнит-экономика' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Задачи' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Рынок' })).toBeInTheDocument()
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
