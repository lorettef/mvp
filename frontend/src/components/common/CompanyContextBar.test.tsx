import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyContextBar } from './CompanyContextBar'

const companiesApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  list: vi.fn(),
}))

vi.mock('@/api/companies', () => ({
  companiesApi: companiesApiMock,
  dashboardApi: { get: vi.fn(), performance: vi.fn() },
}))

const catalogApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/catalog', () => ({ catalogApi: catalogApiMock }))

vi.mock('@/auth/authSession', () => ({ getTenantKey: () => 'org-1' }))

const authStoreMock = vi.hoisted(() => ({
  user: null as { role: string; organizationType?: string; companyId?: string | null; companyName?: string } | null,
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: authStoreMock.user }),
}))

const company = {
  id: 'comp1',
  organizationId: 'org1',
  name: 'Acme',
  industry: 'saas',
  businessModel: 'subscription',
  geography: 'RU',
  grossMargin: 0.75,
  selectedMetrics: [],
  archivedAt: null,
  createdAt: '',
}

function renderBar(initialEntry: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/dashboard" element={<CompanyContextBar />} />
          <Route path="/companies/:companyId" element={<CompanyContextBar />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CompanyContextBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    companiesApiMock.get.mockResolvedValue(company)
    companiesApiMock.list.mockResolvedValue([company])
    catalogApiMock.get.mockResolvedValue({
      industries: [{ slug: 'saas', label: 'SaaS' }],
      business_models: [{ slug: 'subscription', label: 'Подписка (SaaS)', description: '' }],
      profiles: {},
    })
  })

  it('renders grouped navigation for a fund admin inside a company', async () => {
    authStoreMock.user = { role: 'admin', organizationType: 'fund', companyId: null }
    renderBar('/companies/comp1')

    expect(await screen.findByText('Рост')).toBeInTheDocument()
    expect(screen.getByText('Юнит-экономика')).toBeInTheDocument()
    expect(screen.getByText('Финансы')).toBeInTheDocument()
    expect(screen.getByText('Планирование')).toBeInTheDocument()
    expect(screen.getByText('Задачи')).toBeInTheDocument()
    expect(screen.getByText('Отчёты')).toBeInTheDocument()
    expect(screen.queryByText('Обзор')).not.toBeInTheDocument()
  })

  it('opens the Finance dropdown with the six finance tabs', async () => {
    const user = userEvent.setup()
    authStoreMock.user = { role: 'admin', organizationType: 'fund', companyId: null }
    renderBar('/companies/comp1')

    await user.click(await screen.findByRole('button', { name: /Финансы/ }))
    expect(await screen.findByText('Бюджет')).toBeInTheDocument()
    expect(screen.getByText('P&L')).toBeInTheDocument()
    expect(screen.getByText('Cash Flow')).toBeInTheDocument()
    expect(screen.getByText('Кредиты')).toBeInTheDocument()
    expect(screen.getByText('Оценка')).toBeInTheDocument()
    expect(screen.getByText('Чувствительность')).toBeInTheDocument()
  })

  it('shows Overview (active on /dashboard) for a startup without a switcher', async () => {
    authStoreMock.user = { role: 'admin', organizationType: 'startup', companyId: 'comp1' }
    renderBar('/dashboard')

    expect(await screen.findByText('Обзор')).toBeInTheDocument()
    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Сменить компанию/ })).not.toBeInTheDocument()
  })

  it('renders nothing outside company context for a fund admin', async () => {
    authStoreMock.user = { role: 'admin', organizationType: 'fund', companyId: null }
    const { container } = renderBar('/dashboard')

    await new Promise((r) => setTimeout(r, 0))
    expect(container.querySelector('nav[aria-label="Навигация компании"]')).not.toBeInTheDocument()
  })
})
