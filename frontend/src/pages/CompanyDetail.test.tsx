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
  },
}))

vi.mock('@/api/companies', () => ({ companiesApi: mocks.companiesApi }))

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
  })

  it('renders 3 tab triggers', async () => {
    renderCompanyDetail()
    expect(await screen.findByRole('tab', { name: 'Метрики' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Когорты' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Бюджет' })).toBeInTheDocument()
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
