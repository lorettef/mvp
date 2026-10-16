import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import type { User } from '@/store/authStore'
import { StartupDashboard } from './StartupDashboard'
import { Dashboard } from './Dashboard'

const mocks = vi.hoisted(() => ({
  user: null as User | null,
  companyGet: vi.fn(),
  companyCreate: vi.fn(),
  catalogGet: vi.fn(),
  insight: vi.fn(),
}))

vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: mocks.user }) }))
vi.mock('@/auth/authSession', () => ({ getTenantKey: () => 'startup-org' }))
vi.mock('@/api/catalog', () => ({ catalogApi: { get: mocks.catalogGet } }))
vi.mock('@/api/pnl', () => ({ pnlApi: { get: vi.fn().mockResolvedValue(null) } }))
vi.mock('@/api/companies', () => ({
  companiesApi: {
    get: mocks.companyGet,
    insight: mocks.insight,
    create: mocks.companyCreate,
    metrics: vi.fn().mockResolvedValue([]),
    unitEconomics: vi.fn().mockResolvedValue(null),
    cohorts: vi.fn().mockResolvedValue([]),
    health: vi.fn().mockResolvedValue(null),
    tasks: vi.fn().mockResolvedValue([]),
  },
}))
vi.mock('@/components/dashboard/StartupKpi', () => ({ StartupKpi: () => null }))

const startupUser: User = {
  id: 'startup-admin',
  email: 'startup@example.com',
  fullName: 'Startup admin',
  companyName: 'Existing company',
  role: 'admin',
  productRole: 'startup',
  organizationId: 'startup-org',
  organizationType: 'startup',
  companyId: 'existing-company',
  subscriptionPlan: 'pro',
  dailyLimit: 10,
  usedToday: 0,
}

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <StartupDashboard companyId="existing-company" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Legacy startup overview capabilities', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    mocks.user = startupUser
    mocks.insight.mockReset().mockResolvedValue({ companyId: 'existing-company', scenario: 'overview', provider: 'demo', text: 'Проблема\nДанных мало.\nПричина\nПричина неизвестна.\nДействие\nСверьте данные.\nДедлайн: сегодня' })
    mocks.companyGet.mockReset().mockResolvedValue({
      id: 'existing-company',
      name: 'Existing company',
      geography: 'Россия',
      industry: 'saas',
      businessModel: 'subscription',
      grossMargin: 0.75,
      selectedMetrics: ['revenue'],
    })
    mocks.companyCreate.mockReset().mockResolvedValue({ id: 'new-company' })
    mocks.catalogGet.mockReset().mockResolvedValue({
      industries: [{ slug: 'saas', label: 'SaaS' }],
      business_models: [{ slug: 'subscription', label: 'Подписка (SaaS)', description: '' }],
      profiles: {
        saas: {
          subscription: {
            label: 'SaaS', why: '',
            metrics: [{ key: 'revenue', label: 'Выручка', why: '', required: true }],
            derived: [],
          },
        },
      },
    })
  })

  it('does not offer another company to an already bound startup admin', async () => {
    renderDashboard()
    await screen.findByText('Existing company')
    expect(screen.queryByRole('button', { name: 'Добавить компанию' })).not.toBeInTheDocument()
    expect(mocks.companyCreate).not.toHaveBeenCalled()
  })

  it('does not render a company for inconsistent observer/startup context', async () => {
    mocks.user = { ...startupUser, role: 'observer', productRole: null }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={queryClient}><MemoryRouter><Dashboard /></MemoryRouter></QueryClientProvider>)
    expect(await screen.findByText('Нет доступа', { exact: true })).toBeVisible()
    expect(mocks.companyGet).not.toHaveBeenCalled()
    expect(mocks.insight).not.toHaveBeenCalled()
  })

  it.each(['admin', 'company'])('retains explicit Company AI generation for allowed startup role %s', async (role) => {
    mocks.user = { ...startupUser, role }
    renderDashboard()
    const generate = await screen.findByRole('button', { name: 'Запустить AI-анализ' })
    expect(mocks.insight).not.toHaveBeenCalled()
    fireEvent.click(generate)
    await waitFor(() => expect(mocks.insight).toHaveBeenCalledOnce())
    expect(mocks.insight).toHaveBeenCalledWith('existing-company', 'overview')
  })

  it('does not offer company creation to a company user', async () => {
    mocks.user = { ...startupUser, role: 'company' }
    renderDashboard()
    await screen.findByText('Existing company')
    expect(screen.queryByRole('button', { name: 'Добавить компанию' })).not.toBeInTheDocument()
  })

  it('keeps the startup source entry available after changing language', async () => {
    renderDashboard()
    await screen.findByRole('button', { name: 'Все разделы' })
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.queryByRole('button', { name: 'Add company' })).not.toBeInTheDocument()
    expect(mocks.companyCreate).not.toHaveBeenCalled()
  })})
