import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import type { User } from '@/store/authStore'
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
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function selectOption(triggerName: string, optionName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: triggerName }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}

describe('Startup company creation from Dashboard', () => {
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

  it('opens the existing four-stage wizard from the Startup dashboard and creates a company', async () => {
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Добавить компанию' }))

    const dialog = screen.getByRole('dialog', { name: 'Добавить компанию' })
    expect(within(dialog).getByText('Шаг 1 из 4')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Прогресс настройки').children).toHaveLength(4)

    fireEvent.change(screen.getByPlaceholderText('Название компании'), { target: { value: 'New company' } })
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
    expect(within(dialog).getByText('Шаг 2 из 4')).toBeInTheDocument()

    selectOption('Сфера деятельности', 'SaaS')
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
    expect(within(dialog).getByText('Шаг 3 из 4')).toBeInTheDocument()

    selectOption('Бизнес-модель', 'Подписка (SaaS)')
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
    expect(within(dialog).getByText('Шаг 4 из 4')).toBeInTheDocument()
    expect(within(dialog).getByText('Отметьте метрики, которые будете отслеживать. Список можно изменить позже.')).toBeInTheDocument()

    expect(within(dialog).queryByRole('spinbutton', { name: /маржа/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
    expect(within(dialog).queryByRole('spinbutton', { name: /маржа/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))
    await waitFor(() => expect(mocks.companyCreate).toHaveBeenCalledWith(expect.objectContaining({
      name: 'New company', selected_metrics: ['revenue'],
    })))
    expect(mocks.companyCreate.mock.calls[0][0]).not.toHaveProperty('gross_margin')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeps the observer startup overview read-only without forbidden AI actions or requests', async () => {
    mocks.user = { ...startupUser, role: 'observer' }
    renderDashboard()
    await screen.findByText('Existing company')
    expect(screen.queryByRole('button', { name: 'AI-анализ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Запустить AI-анализ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Создать задачу' })).not.toBeInTheDocument()
    expect(mocks.insight).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Все разделы' })).toBeVisible()
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

  it('updates the real entry point when the language changes', async () => {
    renderDashboard()
    await screen.findByRole('button', { name: 'Добавить компанию' })
    await act(async () => { await i18n.changeLanguage('en') })
    fireEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(screen.getByRole('dialog', { name: 'Add company' })).toBeInTheDocument()
  })
})
