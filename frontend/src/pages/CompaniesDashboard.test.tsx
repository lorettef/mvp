import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompaniesDashboard } from './CompaniesDashboard'
import type { CompanyStatusItem, DashboardFilters, DashboardResponse } from '@/types/api'
import type { ReactElement } from 'react'

// Keep real Recharts series/legend rendering; jsdom has no layout measurements.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement } = await import('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 256 }),
  }
})

const navigateMock = vi.hoisted(() => vi.fn())
function expectNavigationTo(path: string) {
  expect(navigateMock).toHaveBeenCalledTimes(1)
  expect(navigateMock).toHaveBeenCalledWith(path)
}
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useNavigate: () => navigateMock,
}))

const companiesApiMock = vi.hoisted(() => ({
  create: vi.fn(),
  list: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
}))

const dashboardApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  performance: vi.fn(),
}))

const catalogApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

const invitesApiMock = vi.hoisted(() => ({
  create: vi.fn(),
}))

const authStoreMock = vi.hoisted(() => ({
  user: { role: 'admin' },
}))

vi.mock('@/api/companies', () => ({
  companiesApi: companiesApiMock,
  dashboardApi: dashboardApiMock,
}))
vi.mock('@/api/catalog', () => ({ catalogApi: catalogApiMock }))
vi.mock('@/api/invites', () => ({ invitesApi: invitesApiMock }))
vi.mock('../auth/authSession', () => ({ getTenantKey: () => 'org-1' }))
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: authStoreMock.user }),
}))

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CompaniesDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CompaniesDashboard acceptance — unavailable KPI', () => {
  const company: CompanyStatusItem = { id: 'acceptance', name: 'Acceptance company', industry: 'saas',
    geography: null, businessModel: null, health: 'healthy', status: 'no_plan', latestRevenue: 100,
    latestPlanRevenue: null, revenueGrowth: null, runwayMonths: null, lastUpdate: '2026-09-01', attention: [], taskProgress: null,
    fact: { period: '2026-09-01', revenue: 100, newUnits: 1, arpu: 100, marketingSpend: 10,
      retentionRate: 0.95, churn: 0.05, ltv: 2000, cac: 10 }, plan: null,
  }
  const response: DashboardResponse = { totalCompanies: 1, avgRevenue: 100, avgCac: 10, avgLtv: 2000, avgChurn: 0.05,
    portfolioRevenue: 100, revenueGrowth: null, avgRunway: null, companiesAtRisk: 0, companiesWithoutData: 0,
    onTrack: 0, behind: 0, noPlan: 1, noData: 0, companies: [company], profitabilityByIndustry: [],
  }
  beforeEach(() => {
    navigateMock.mockReset()
    dashboardApiMock.get.mockReset().mockResolvedValue(response)
    dashboardApiMock.performance.mockReset().mockResolvedValue([])
    companiesApiMock.list.mockReset().mockResolvedValue([])
    catalogApiMock.get.mockReset().mockResolvedValue({ industries: [{ slug: 'saas', label: 'SaaS' }] })
  })

  it.each(['no_plan', 'no_data'] as const)('explains unavailable plan execution for %s without inventing 0%%', async status => {
    dashboardApiMock.get.mockResolvedValue(status === 'no_plan' ? response : { ...response, noPlan: 0, noData: 1,
      companies: [{ ...company, status, fact: null, latestRevenue: null }] })
    renderDashboard()
    const trigger = await screen.findByRole('button', { name: 'Выполняют план' })
    expect(within(trigger.closest('.rounded-lg')!).getByText('—', { exact: true })).toBeInTheDocument()
    act(() => trigger.focus())
    await userEvent.setup().keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Выполняют план' })).toHaveTextContent('В текущей выборке нет компаний с сопоставимыми данными План/Факт за выбранный период.')
    expect(screen.queryByText('0%', { exact: true })).not.toBeInTheDocument()
    expect(screen.queryByText(/no_plan|no_data/)).not.toBeInTheDocument()
  })

  it('keeps genuine 0% available when comparable Plan/Fact exists', async () => {
    dashboardApiMock.get.mockResolvedValue({ ...response, behind: 1, noPlan: 0,
      companies: [{ ...company, status: 'behind', latestPlanRevenue: 200, plan: { ...company.fact!, revenue: 200 } }] })
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(screen.getByText('0%', { exact: true })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Выполняют план' })).not.toBeInTheDocument()
  })

  it.each([
    ['Рост выручки', 'Для текущей выборки недостаточно сопоставимых фактических данных для расчёта динамики.'],
    ['Средний runway', 'Для текущей выборки runway нельзя определить по доступным данным о денежных средствах и расходах.'],
  ])('explains unavailable %s for the current selection', async (label, reason) => {
    renderDashboard()
    const trigger = await screen.findByRole('button', { name: label })
    fireEvent.click(trigger)
    expect(await screen.findByRole('dialog', { name: label })).toHaveTextContent(reason)
  })

  it('explains missing portfolio revenue while keeping the six cards and real zero values', async () => {
    dashboardApiMock.get.mockResolvedValue({ ...response, portfolioRevenue: null, noPlan: 0, noData: 1,
      companies: [{ ...company, status: 'no_data', latestRevenue: null, fact: null }] })
    const view = renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Выручка портфеля' }))
    expect(await screen.findByRole('dialog', { name: 'Выручка портфеля' })).toHaveTextContent('В текущей выборке нет фактических данных о выручке за выбранный период.')
    await userEvent.setup().keyboard('{Escape}')
    for (const label of ['Компании в портфеле', 'Выручка портфеля', 'Рост выручки', 'Выполняют план', 'В зоне риска', 'Средний runway']) {
      expect(screen.getAllByText(label, { selector: 'span,button', exact: true })).toHaveLength(1)
    }
    view.unmount()
    dashboardApiMock.get.mockResolvedValue({ ...response, portfolioRevenue: 0, revenueGrowth: 0, avgRunway: 0 })
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    for (const label of ['Выручка портфеля', 'Рост выручки', 'Средний runway']) {
      expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument()
    }
  })

  it('keeps the dashboard visible on catalog failure and exposes a retry for filter options', async () => {
    catalogApiMock.get.mockRejectedValueOnce(new Error('Catalog unavailable'))
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    const user = userEvent.setup()
    await user.click(within(screen.getByRole('complementary', { name: 'Фильтры' })).getByRole('button', { name: /^Сфера деятельности:/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось загрузить варианты.')
    catalogApiMock.get.mockResolvedValue({ industries: [{ slug: 'saas', label: 'SaaS' }] })
    await user.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('menuitemcheckbox', { name: 'SaaS' })).toBeInTheDocument()
  })

  it('shows dashboard errors with retry instead of empty or stale analytics', async () => {
    dashboardApiMock.get.mockRejectedValueOnce(new Error('Dashboard unavailable'))
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Dashboard unavailable')
    expect(screen.queryByRole('region', { name: 'План vs Факт по компаниям' })).not.toBeInTheDocument()
    dashboardApiMock.get.mockResolvedValue(response)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('tab', { name: 'Активные компании (1)' })).toBeInTheDocument()
  })

  it('uses full metric terminology and only lifecycle tabs, without legacy title or recalculation', async () => {
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(screen.getByRole('tab', { name: 'Неактивные (0)' })).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: /Архив/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Требует внимания' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Принудительный.*(расчёт|пересчёт)/ })).not.toBeInTheDocument()
    expect(screen.queryByText('SaaS Unit Economics')).not.toBeInTheDocument()
    for (const label of ['LTV', 'CAC', 'Churn']) expect(screen.queryByText(label, { exact: true })).not.toBeInTheDocument()
    const table = screen.getByRole('table', { name: 'Юнит-экономика компаний' })
    for (const label of ['Пожизненная ценность клиента (LTV)', 'Стоимость привлечения клиента (CAC)', 'Отток клиентов (Churn)']) {
      expect(within(table).getByRole('columnheader', { name: label })).toBeInTheDocument()
    }
  })
})

describe('CompaniesDashboard startup invites', () => {
  beforeEach(() => {
    companiesApiMock.create.mockReset()
    companiesApiMock.list.mockReset()
    companiesApiMock.list.mockResolvedValue([])
    dashboardApiMock.performance.mockReset()
    dashboardApiMock.performance.mockResolvedValue([])
    dashboardApiMock.get.mockReset()
    dashboardApiMock.get.mockResolvedValue({
      totalCompanies: 0,
      avgRevenue: null,
      onTrack: 0,
      behind: 0,
      companies: [],
    })
    catalogApiMock.get.mockReset()
    catalogApiMock.get.mockResolvedValue({
      industries: [{ slug: 'saas', label: 'SaaS' }],
      business_models: [{ slug: 'subscription', label: 'Подписка', description: '' }],
      profiles: { saas: { subscription: { label: '', why: '', metrics: [], derived: [] } } },
    })
    invitesApiMock.create.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    })
  })

  it('closes the invite dialog without creating an invite and can reopen it', async () => {
    invitesApiMock.create.mockResolvedValue({
      token: 'reopened-token',
      expiresAt: '2026-09-09T00:00:00Z',
      email: null,
    })
    renderDashboard()
    const openButton = await screen.findByRole('button', { name: 'Пригласить стартап' })

    fireEvent.click(openButton)
    const dialog = screen.getByRole('dialog', { name: 'Пригласить стартап' })
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeInTheDocument()
    expect(invitesApiMock.create).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(invitesApiMock.create).not.toHaveBeenCalled()
    expect(openButton).toBeInTheDocument()

    fireEvent.click(openButton)
    expect(screen.getByRole('dialog', { name: 'Пригласить стартап' })).toBeInTheDocument()
    expect(invitesApiMock.create).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))
    expect(await screen.findByDisplayValue(/\/invite\/reopened-token/)).toBeInTheDocument()
    expect(invitesApiMock.create).toHaveBeenCalledTimes(1)
  })

  it('creates an invite and reveals the full startup link', async () => {
    invitesApiMock.create.mockResolvedValue({
      token: 'startup-token',
      expiresAt: '2026-09-09T00:00:00Z',
      email: null,
    })

    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))

    await waitFor(() => expect(invitesApiMock.create).toHaveBeenCalledWith())

    const linkInput = await screen.findByDisplayValue(/\/invite\/startup-token/)
    expect(linkInput.getAttribute('value')).toContain('/invite/startup-token')
  })

  it('copies the revealed invite link to the clipboard', async () => {
    invitesApiMock.create.mockResolvedValue({
      token: 'copy-token',
      expiresAt: '2026-09-09T00:00:00Z',
      email: null,
    })

    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))
    const linkInput = await screen.findByDisplayValue(/\/invite\/copy-token/)

    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }))

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkInput.getAttribute('value')),
    )
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
  })

  it('places Invite with the title and removes the subtitle and dashboard recalculation', async () => {
    renderDashboard()
    const title = await screen.findByRole('heading', { name: 'Портфель компаний', level: 1 })
    const header = title.closest('div')!.parentElement!
    expect(within(header).getByRole('button', { name: 'Пригласить стартап' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Пригласить стартап' })).toHaveLength(1)
    expect(screen.queryByText('Обзор всех стартапов акселератора')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Принудительный пересчёт|Пересчитывается/ })).not.toBeInTheDocument()
  })

  it('keeps invite loading and prevents duplicate create requests', async () => {
    let resolveInvite!: (value: { token: string }) => void
    invitesApiMock.create.mockImplementation(() => new Promise((resolve) => { resolveInvite = resolve }))
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    const createButton = screen.getByRole('button', { name: 'Создать ссылку' })
    fireEvent.click(createButton)
    fireEvent.click(createButton)
    expect(await screen.findByRole('button', { name: 'Создание ссылки...' })).toBeDisabled()
    expect(invitesApiMock.create).toHaveBeenCalledTimes(1)
    await act(async () => resolveInvite({ token: 'single-request' }))
    expect(await screen.findByDisplayValue(/\/invite\/single-request/)).toBeInTheDocument()
  })

  it('allows retrying invite creation after a failed request', async () => {
    invitesApiMock.create.mockRejectedValueOnce(new Error('Invite unavailable')).mockResolvedValue({ token: 'retried-token' })
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))
    await waitFor(() => expect(invitesApiMock.create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Создать ссылку' })).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))
    expect(await screen.findByDisplayValue(/\/invite\/retried-token/)).toBeInTheDocument()
    expect(invitesApiMock.create).toHaveBeenCalledTimes(2)
  })

  it('explains clipboard failure and keeps the invitation available for manual copy and retry', async () => {
    invitesApiMock.create.mockResolvedValue({ token: 'manual-copy-token' })
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard denied')).mockResolvedValue(undefined)
    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))
    const input = await screen.findByDisplayValue(/\/invite\/manual-copy-token/)
    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось скопировать ссылку. Скопируйте её вручную.')
    expect(input).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }))
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard denied again'))
    fireEvent.click(screen.getByRole('button', { name: 'Скопировано' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось скопировать ссылку.')
    expect(screen.getByRole('button', { name: 'Копировать' })).toBeInTheDocument()
    expect(invitesApiMock.create).toHaveBeenCalledTimes(1)
  })
})

describe('CompaniesDashboard company creation', () => {
  beforeEach(() => {
    companiesApiMock.create.mockReset()
    companiesApiMock.list.mockReset()
    companiesApiMock.list.mockResolvedValue([])
    dashboardApiMock.performance.mockReset()
    dashboardApiMock.performance.mockResolvedValue([])
    dashboardApiMock.get.mockReset()
    dashboardApiMock.get.mockResolvedValue({
      totalCompanies: 0,
      avgRevenue: null,
      onTrack: 0,
      behind: 0,
      companies: [],
    })
    catalogApiMock.get.mockReset()
    catalogApiMock.get.mockResolvedValue({ industries: [], business_models: [], profiles: {} })
  })

  it('offers invites but no direct company creation form to a fund', async () => {
    renderDashboard()
    expect(await screen.findByRole('button', { name: 'Пригласить стартап' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Добавить компанию' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Название компании' })).not.toBeInTheDocument()
    expect(companiesApiMock.create).not.toHaveBeenCalled()
  })
})

describe('CompaniesDashboard revenue chart', () => {
  const points = [
    { month: '2026-08', fact: 1200, plan: 1400 },
    { month: '2026-09', fact: 0, plan: null },
    { month: '2026-10', fact: null, plan: 1800 },
  ]

  beforeEach(() => {
    companiesApiMock.list.mockReset().mockResolvedValue([])
    dashboardApiMock.get.mockReset().mockResolvedValue({ totalCompanies: 0, companies: [] })
    dashboardApiMock.performance.mockReset().mockResolvedValue(points)
    catalogApiMock.get.mockReset().mockResolvedValue({ industries: [] })
  })

  it('requests default months=6 and shows both bar series', async () => {
    const { container } = renderDashboard()
    await screen.findByRole('region', { name: 'Выручка портфеля по месяцам' })
    expect(dashboardApiMock.performance).toHaveBeenCalledWith(6, expect.objectContaining({ signal: expect.any(AbortSignal) }))
    expect(screen.getByRole('button', { name: '6' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Факт + план' })).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect(container.querySelector('.recharts-line')).not.toBeInTheDocument()
  })

  it.each([3, 12])('requests months=%i when the range changes', async (months) => {
    renderDashboard()
    await screen.findByRole('region', { name: 'Выручка портфеля по месяцам' })
    await userEvent.setup().click(screen.getByRole('button', { name: String(months) }))
    await waitFor(() => expect(dashboardApiMock.performance).toHaveBeenCalledWith(months, expect.objectContaining({ signal: expect.any(AbortSignal) })))
    expect(screen.getByRole('button', { name: String(months) })).toHaveAttribute('aria-pressed', 'true')
  })

  it('switches Fact/Plan series locally and can return to both', async () => {
    const { container } = renderDashboard()
    await screen.findByRole('region', { name: 'Выручка портфеля по месяцам' })
    const user = userEvent.setup()
    for (const name of ['Факт', 'План']) {
      await user.click(screen.getByRole('button', { name }))
      expect(container.querySelectorAll('.recharts-bar')).toHaveLength(1)
      expect(container.querySelector('.recharts-legend-item')).toHaveTextContent(name)
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'true')
    }
    await user.click(screen.getByRole('button', { name: 'Факт + план' }))
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect(dashboardApiMock.performance).toHaveBeenCalledTimes(1)
  })

  it('explains empty performance instead of rendering an empty chart', async () => {
    dashboardApiMock.performance.mockResolvedValue([])
    const { container } = renderDashboard()
    expect(await screen.findByText('Добавьте метрики, чтобы увидеть динамику выручки.')).toBeInTheDocument()
    expect(container.querySelector('.recharts-bar')).not.toBeInTheDocument()
  })

  it('does not render fictitious Fact values when only Plan is available', async () => {
    dashboardApiMock.performance.mockResolvedValue([{ month: '2026-10', fact: null, plan: 1800 }])
    renderDashboard()
    await screen.findByRole('region', { name: 'Выручка портфеля по месяцам' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Факт' }))
    expect(screen.getByText('Нет данных для выбранного режима.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Выручка портфеля по месяцам' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'План' }))
    expect(screen.getByRole('region', { name: 'Выручка портфеля по месяцам' })).toBeInTheDocument()
  })

  it('shows a performance error and retries through the existing API', async () => {
    dashboardApiMock.performance.mockRejectedValueOnce(new Error('Performance unavailable'))
    renderDashboard()
    expect(await screen.findByRole('alert')).toHaveTextContent('Performance unavailable')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByRole('region', { name: 'Выручка портфеля по месяцам' })).toBeInTheDocument()
  })
})

describe('CompaniesDashboard lifecycle tabs', () => {
  const activeCompany: CompanyStatusItem = {
    id: 'active-1', name: 'Active Alpha', industry: 'saas', geography: null,
    businessModel: null, status: 'on_track', latestRevenue: 1200,
    latestPlanRevenue: 1000, revenueGrowth: 0.2, runwayMonths: 8,
    lastUpdate: '2026-09-01', health: 'healthy', attention: [], taskProgress: null,
  }
  const attentionCompany: CompanyStatusItem = {
    ...activeCompany, id: 'attention-1', name: 'Attention Beta', status: 'no_plan',
    // An informational attention reason is not the same as the at-risk KPI.
    attention: [{ kind: 'no_plan', label: 'Нет плана для сравнения', severity: 'info' }],
  }
  const archivedCompany = { id: 'archived-1', name: 'Inactive Gamma' }

  beforeEach(() => {
    navigateMock.mockReset()
    companiesApiMock.archive.mockReset().mockResolvedValue({})
    companiesApiMock.restore.mockReset().mockResolvedValue({})
    companiesApiMock.remove.mockReset().mockResolvedValue({})
    companiesApiMock.list.mockReset().mockResolvedValue([archivedCompany])
    dashboardApiMock.get.mockReset().mockResolvedValue({
      totalCompanies: 2, companiesAtRisk: 0, onTrack: 1, behind: 0,
      companies: [activeCompany, attentionCompany],
    })
    dashboardApiMock.performance.mockReset().mockResolvedValue([])
    catalogApiMock.get.mockReset().mockResolvedValue({ industries: [] })
  })

  async function openTab(name: string) {
    const user = userEvent.setup()
    await user.click(await screen.findByRole('tab', { name }))
    return user
  }

  it('defaults to Active with adjacent counts and preserves company metrics/actions', async () => {
    renderDashboard()
    const activeTab = await screen.findByRole('tab', { name: 'Активные компании (2)' })
    expect(activeTab).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByRole('tab', { name: 'Неактивные (1)' })).toHaveAttribute('aria-selected', 'false')
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getAllByText('Active Alpha').length).toBeGreaterThan(0)
    expect(within(panel).getAllByText('₽1 200').length).toBeGreaterThan(0)
    expect(within(panel).getAllByRole('button', { name: 'AI-анализ' }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { name: 'Требует внимания' })).not.toBeInTheDocument()
  })

  it('shows only attention companies and reasons, independently of the at-risk KPI', async () => {
    renderDashboard()
    await openTab('Требует внимания (1)')
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByText('Attention Beta')).toBeInTheDocument()
    expect(within(panel).getByText('Нет плана для сравнения')).toBeInTheDocument()
    expect(within(panel).queryByText('Active Alpha')).not.toBeInTheDocument()
  })

  it('opens real Attention reasons with keyboard and mobile tap without navigating the company', async () => {
    dashboardApiMock.get.mockResolvedValue({ totalCompanies: 1, companies: [{ ...attentionCompany,
      attention: [...attentionCompany.attention, { kind: 'cac_rising', label: 'CAC растёт', severity: 'warning' }],
    }] })
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    const panel = screen.getByRole('tabpanel')
    const row = within(panel).getByRole('row', { name: 'Открыть: Attention Beta' })
    const label = 'Причины внимания: Attention Beta (2)'
    const trigger = within(row).getByRole('button', { name: label })
    act(() => trigger.focus())
    const user = userEvent.setup()
    await user.keyboard('{Enter}')
    const explanation = await screen.findByRole('dialog', { name: label })
    expect(explanation).toHaveTextContent('Нет плана для сравнения')
    expect(explanation).toHaveTextContent('Стоимость привлечения клиента (CAC) растёт')
    expect(trigger).toHaveAccessibleDescription(/Нет плана для сравнения/)
    expect(navigateMock).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    const card = within(panel).getByRole('link', { name: 'Открыть: Attention Beta' })
    const mobileTrigger = within(card).getByRole('button', { name: label })
    fireEvent.pointerEnter(mobileTrigger, { pointerType: 'touch' })
    fireEvent.click(mobileTrigger)
    expect(await screen.findByRole('dialog', { name: label })).toHaveTextContent('Стоимость привлечения клиента (CAC) растёт')
    expect(navigateMock).not.toHaveBeenCalled()
    fireEvent.click(mobileTrigger)
    await openTab('Требует внимания (1)')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Стоимость привлечения клиента (CAC) растёт')
    expect(screen.queryByText('CAC растёт', { exact: true })).not.toBeInTheDocument()
  })

  it('shows archivedQuery companies in Inactive', async () => {
    renderDashboard()
    await openTab('Неактивные (1)')
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Inactive Gamma')
    expect(companiesApiMock.list).toHaveBeenCalledWith(expect.objectContaining({ archived: true }))
    expect(within(screen.getByRole('tabpanel')).queryByText('Active Alpha')).not.toBeInTheDocument()
  })

  it('archives a company without navigating and updates the counts after refetch', async () => {
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    dashboardApiMock.get.mockResolvedValue({ totalCompanies: 1, companies: [attentionCompany] })
    companiesApiMock.list.mockResolvedValue([archivedCompany, activeCompany])
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Архивировать' })[0])
    await waitFor(() => expect(companiesApiMock.archive).toHaveBeenCalledWith('active-1'))
    expect(await screen.findByRole('tab', { name: 'Активные компании (1)' })).toBeInTheDocument()
    expect(await screen.findByRole('tab', { name: 'Неактивные (2)' })).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['Восстановить', 'restore'],
    ['Удалить', 'remove'],
  ] as const)('%s works without row navigation and refreshes Inactive', async (label, method) => {
    renderDashboard()
    const user = await openTab('Неактивные (1)')
    companiesApiMock.list.mockResolvedValue([])
    await user.click(within(screen.getByRole('tabpanel')).getByRole('button', { name: label }))
    await waitFor(() => expect(companiesApiMock[method]).toHaveBeenCalledWith('archived-1'))
    expect(await screen.findByText('Неактивных компаний нет.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Неактивные (0)' })).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('opens Active from the entire table row and supports keyboard activation', async () => {
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    const row = within(screen.getByRole('tabpanel')).getByRole('row', { name: 'Открыть: Active Alpha' })
    fireEvent.click(within(row).getByText('₽1 200'))
    expectNavigationTo('/companies/active-1')
    navigateMock.mockClear()
    act(() => row.focus())
    fireEvent.keyDown(row, { key: 'Enter' })
    expectNavigationTo('/companies/active-1')
  })

  it('opens from the name/Open/AI actions exactly once, including keyboard events', async () => {
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    const row = within(screen.getByRole('tabpanel')).getByRole('row', { name: 'Открыть: Active Alpha' })
    const user = userEvent.setup()
    await user.click(within(row).getByRole('button', { name: /Active Alpha/ }))
    expectNavigationTo('/companies/active-1')
    navigateMock.mockClear()
    await user.click(within(row).getByRole('button', { name: 'Открыть' }))
    expectNavigationTo('/companies/active-1')
    navigateMock.mockClear()
    const aiButton = within(row).getByRole('button', { name: 'AI-анализ' })
    fireEvent.keyDown(aiButton, { key: 'Enter' })
    expect(navigateMock).not.toHaveBeenCalled()
    await user.click(aiButton)
    expectNavigationTo('/companies/active-1?tab=unit')
  })

  it('opens Attention and Inactive rows with mouse and keyboard', async () => {
    renderDashboard()
    const user = await openTab('Требует внимания (1)')
    await user.click(screen.getByRole('button', { name: /Attention Beta/ }))
    expectNavigationTo('/companies/attention-1')
    navigateMock.mockClear()
    await user.click(screen.getByRole('tab', { name: 'Неактивные (1)' }))
    const row = screen.getByText('Inactive Gamma').closest('li')!
    fireEvent.click(row)
    expectNavigationTo('/companies/archived-1')
    navigateMock.mockClear()
    fireEvent.keyDown(row, { key: ' ' })
    expectNavigationTo('/companies/archived-1')
  })

  it('supports keyboard navigation between tabs', async () => {
    renderDashboard()
    const activeTab = await screen.findByRole('tab', { name: 'Активные компании (2)' })
    act(() => activeTab.focus())
    await userEvent.setup().keyboard('{ArrowRight}')
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Требует внимания (1)' })).toHaveAttribute('aria-selected', 'true'))
  })

  it('provides explicit empty states in every tab', async () => {
    dashboardApiMock.get.mockResolvedValue({ totalCompanies: 0, companies: [] })
    companiesApiMock.list.mockResolvedValue([])
    renderDashboard()
    expect(await screen.findByText('Активных компаний нет.')).toBeInTheDocument()
    const user = await openTab('Требует внимания (0)')
    expect(screen.getByText('Нет компаний, требующих внимания.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Неактивные (0)' }))
    expect(screen.getByText('Неактивных компаний нет.')).toBeInTheDocument()
  })

  it('opens the entire mobile card without propagating its action buttons', async () => {
    renderDashboard()
    const card = await within(await screen.findByRole('tabpanel')).findByRole('link', { name: 'Открыть: Active Alpha' })
    fireEvent.click(within(card).getByText('₽1 200'))
    expectNavigationTo('/companies/active-1')
    navigateMock.mockClear()
    fireEvent.keyDown(card, { key: 'Enter' })
    expectNavigationTo('/companies/active-1')
    navigateMock.mockClear()
    await userEvent.setup().click(within(card).getByRole('button', { name: 'AI-анализ' }))
    expectNavigationTo('/companies/active-1?tab=unit')
  })

  it('shows Inactive loading rather than a misleading empty state', async () => {
    companiesApiMock.list.mockReturnValue(new Promise(() => {}))
    renderDashboard()
    await openTab('Неактивные (…)')
    expect(within(screen.getByRole('tabpanel')).getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Неактивных компаний нет.')).not.toBeInTheDocument()
  })

  it('shows Inactive errors and can retry without hiding Active', async () => {
    companiesApiMock.list.mockRejectedValue(new Error('Inactive unavailable'))
    renderDashboard()
    expect(await screen.findByRole('tab', { name: 'Активные компании (2)' })).toBeInTheDocument()
    await openTab('Неактивные (—)')
    expect(screen.getByRole('alert')).toHaveTextContent('Inactive unavailable')
    companiesApiMock.list.mockResolvedValue([archivedCompany])
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText('Inactive Gamma')).toBeInTheDocument()
  })
})

describe('CompaniesDashboard analytics filters', () => {
  const alpha: CompanyStatusItem = {
    id: 'alpha', name: 'Filter Alpha', industry: 'saas', geography: null, businessModel: null,
    status: 'on_track', health: 'healthy', latestRevenue: 1200, latestPlanRevenue: 1000,
    revenueGrowth: 0.1, runwayMonths: 10, lastUpdate: '2026-02-01', attention: [], taskProgress: null,
    fact: { period: '2026-02-01', revenue: 1200, newUnits: 12, arpu: 100, marketingSpend: 999,
      retentionRate: 0.925, churn: 0.075, ltv: 1500, cac: 20 },
    plan: { period: '2026-02-01', revenue: 1000, newUnits: 10, arpu: 100, marketingSpend: 777,
      retentionRate: 0.9, churn: 0.1, ltv: 1000, cac: 25 },
  }
  const beta: CompanyStatusItem = {
    ...alpha, id: 'beta', name: 'Filter Beta', industry: 'fintech', status: 'behind', health: 'critical',
    latestRevenue: 1800, latestPlanRevenue: 2000, revenueGrowth: 0.3, runwayMonths: 2,
    fact: { ...alpha.fact!, revenue: 1800 }, plan: { ...alpha.plan!, revenue: 2000 },
    attention: [{ kind: 'behind_plan', label: 'Отстаёт от плана', severity: 'warning' }],
  }
  const full: DashboardResponse = {
    totalCompanies: 2, avgRevenue: 1500, avgCac: 10, avgLtv: 100, avgChurn: 0.05,
    portfolioRevenue: 3000, revenueGrowth: 0.2, companiesAtRisk: 1, avgRunway: 6,
    companiesWithoutData: 0, onTrack: 1, behind: 1, noPlan: 0, noData: 0, companies: [alpha, beta],
    profitabilityByIndustry: [
      { industry: 'saas', revenue: 1200, totalOpex: 960, ebitda: 240, ebitdaMargin: 0.2, companiesTotal: 1, companiesIncluded: 1 },
      { industry: 'fintech', revenue: 1800, totalOpex: 2000, ebitda: -200, ebitdaMargin: -0.1111, companiesTotal: 1, companiesIncluded: 1 },
    ],
  }
  const selected: DashboardResponse = {
    ...full, totalCompanies: 1, portfolioRevenue: 1200, revenueGrowth: 0.1,
    companiesAtRisk: 0, avgRunway: 10, onTrack: 1, behind: 0, companies: [alpha],
    profitabilityByIndustry: [full.profitabilityByIndustry![0]],
  }
  const empty: DashboardResponse = {
    ...full, totalCompanies: 0, portfolioRevenue: null, revenueGrowth: null,
    avgRevenue: null, avgCac: null, avgLtv: null, avgChurn: null, companiesAtRisk: 0,
    avgRunway: null, onTrack: 0, behind: 0, companies: [], profitabilityByIndustry: [],
  }
  const allPoints = [{ month: '2026-01', fact: 3000, plan: 3000 }]
  const selectedPoints = [{ month: '2026-02', fact: 1200, plan: 1000 }]

  function responseFor(filters: DashboardFilters = {}) {
    if (filters.industries?.includes('edtech') || filters.health?.includes('no_data')) return empty
    if (filters.companyIds?.length === 1 || filters.health?.length || filters.performanceStatus?.length || filters.industries?.length === 1) return selected
    return full
  }

  beforeEach(() => {
    navigateMock.mockReset()
    companiesApiMock.archive.mockReset().mockResolvedValue({})
    companiesApiMock.restore.mockReset().mockResolvedValue({})
    companiesApiMock.remove.mockReset().mockResolvedValue({})
    companiesApiMock.list.mockReset().mockImplementation(({ archived }) => Promise.resolve(archived
      ? [{ id: 'inactive', name: 'Filter Inactive' }]
      : [{ id: 'alpha', name: alpha.name }, { id: 'beta', name: beta.name }]))
    dashboardApiMock.get.mockReset().mockImplementation(({ filters }) => Promise.resolve(responseFor(filters)))
    dashboardApiMock.performance.mockReset().mockImplementation((_months, { filters }) => {
      const response = responseFor(filters)
      return Promise.resolve(response === empty ? [] : response === selected ? selectedPoints : allPoints)
    })
    catalogApiMock.get.mockReset().mockResolvedValue({ industries: [
      { slug: 'saas', label: 'Software as a Service' }, { slug: 'fintech', label: 'Финтех' }, { slug: 'edtech', label: 'Образование' },
    ] })
    invitesApiMock.create.mockReset()
  })

  function sidebar() { return screen.getByRole('complementary', { name: 'Фильтры' }) }
  function lastFilters(): DashboardFilters { return dashboardApiMock.get.mock.calls[dashboardApiMock.get.mock.calls.length - 1][0].filters }
  async function selectOptions(label: string, names: string[]) {
    const user = userEvent.setup()
    await user.click(within(sidebar()).getByRole('button', { name: new RegExp(`^${label}:`) }))
    for (const name of names) await user.click(await screen.findByRole('menuitemcheckbox', { name }))
    await user.keyboard('{Escape}')
  }
  async function waitForInitial() { await screen.findByRole('tab', { name: 'Активные компании (2)' }) }
  function expectKpi(label: string, value: string) {
    const card = screen.getByText(label, { selector: 'span,button' }).closest<HTMLDivElement>('.rounded-lg')!
    expect(within(card).getByText(value)).toBeInTheDocument()
  }

  it('starts without filters and loads independent active company options', async () => {
    renderDashboard()
    await waitForInitial()
    expect(lastFilters()).toEqual({})
    expect(dashboardApiMock.performance).toHaveBeenCalledWith(6, expect.objectContaining({ filters: {}, signal: expect.any(AbortSignal) }))
    expect(companiesApiMock.list).toHaveBeenCalledWith(expect.objectContaining({ archived: false, signal: expect.any(AbortSignal) }))
    expect(within(sidebar()).getByRole('button', { name: 'Сбросить фильтры' })).toBeDisabled()
    expect(within(sidebar()).getByRole('button', { name: 'Компании: Все компании' })).toBeInTheDocument()
  })

  it('supports one/multiple companies, stable options and clearing selection', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Компании', [alpha.name])
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(lastFilters()).toEqual({ companyIds: ['alpha'] })
    expect(within(sidebar()).getByRole('button', { name: 'Компании: 1 компания' })).toBeInTheDocument()
    await selectOptions('Компании', [beta.name])
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    expect(lastFilters()).toEqual({ companyIds: ['alpha', 'beta'] })
    expect(within(sidebar()).getByRole('button', { name: 'Компании: 2 компании' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(within(sidebar()).getByRole('button', { name: /^Компании:/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Очистить выбор' }))
    await waitFor(() => expect(within(sidebar()).getByRole('button', { name: 'Компании: Все компании' })).toBeInTheDocument())
    expect(companiesApiMock.list.mock.calls.filter(([options]) => options.archived === false)).toHaveLength(1)
  })

  it('uses catalog labels while sending slugs and shares every filter with performance + months', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Компании', [beta.name, alpha.name])
    await selectOptions('Сфера деятельности', ['Software as a Service', 'Финтех'])
    await selectOptions('Состояние', ['В норме'])
    await selectOptions('Выполнение плана', ['Выполняет план'])
    fireEvent.change(within(sidebar()).getByLabelText('С'), { target: { value: '2026-01-01' } })
    fireEvent.change(within(sidebar()).getByLabelText('По'), { target: { value: '2026-02-28' } })
    const filters = { companyIds: ['alpha', 'beta'], industries: ['fintech', 'saas'],
      health: ['healthy'], performanceStatus: ['on_track'], periodFrom: '2026-01-01', periodTo: '2026-02-28' }
    await waitFor(() => expect(lastFilters()).toEqual(filters))
    expect(dashboardApiMock.performance).toHaveBeenLastCalledWith(6, expect.objectContaining({ filters, signal: expect.any(AbortSignal) }))
    expect(await screen.findByText('Активных групп фильтров: 5')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: '12' }))
    await waitFor(() => expect(dashboardApiMock.performance).toHaveBeenLastCalledWith(12, expect.objectContaining({ filters })))
  })

  it('updates all KPI, Active, Attention and rendered chart data from new responses', async () => {
    renderDashboard()
    await waitForInitial()
    expectKpi('Компании в портфеле', '2')
    expectKpi('Выручка портфеля', '₽3 000')
    expect(await screen.findByText('2026-01', { selector: 'tspan' })).toBeInTheDocument()
    await selectOptions('Компании', [alpha.name])
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expectKpi('Компании в портфеле', '1')
    expectKpi('Выручка портфеля', '₽1 200')
    expectKpi('Рост выручки', '+10.0%')
    expectKpi('Выполняют план', '100%')
    expectKpi('В зоне риска', '0')
    expectKpi('Средний runway', '10 мес.')
    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getAllByText(alpha.name).length).toBeGreaterThan(0)
    expect(within(panel).queryByText(beta.name)).not.toBeInTheDocument()
    expect(await screen.findByText('2026-02', { selector: 'tspan' })).toBeInTheDocument()
    expect(screen.queryByText('2026-01', { selector: 'tspan' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Требует внимания (0)' }))
    expect(screen.getByText('Нет компаний, требующих внимания.')).toBeInTheDocument()
    expect(screen.queryByText(beta.name)).not.toBeInTheDocument()
  })

  it('blocks inverted dates, retains the last valid request range and allows correction', async () => {
    renderDashboard()
    await waitForInitial()
    const from = within(sidebar()).getByLabelText('С')
    const to = within(sidebar()).getByLabelText('По')
    fireEvent.change(from, { target: { value: '2026-01-01' } })
    fireEvent.change(to, { target: { value: '2026-02-01' } })
    await waitFor(() => expect(lastFilters()).toEqual({ periodFrom: '2026-01-01', periodTo: '2026-02-01' }))
    const dashboardCalls = dashboardApiMock.get.mock.calls.length
    const performanceCalls = dashboardApiMock.performance.mock.calls.length
    fireEvent.change(from, { target: { value: '2026-03-01' } })
    expect(screen.getByRole('alert')).toHaveTextContent('Дата начала не может быть позже даты окончания')
    expect(from).toHaveAttribute('aria-invalid', 'true')
    expect(to).toHaveAttribute('aria-invalid', 'true')
    expect(dashboardApiMock.get).toHaveBeenCalledTimes(dashboardCalls)
    expect(dashboardApiMock.performance).toHaveBeenCalledTimes(performanceCalls)
    await selectOptions('Состояние', ['В норме'])
    expect(lastFilters()).toEqual({ periodFrom: '2026-01-01', periodTo: '2026-02-01', health: ['healthy'] })
    fireEvent.change(to, { target: { value: '2026-04-01' } })
    await waitFor(() => expect(lastFilters()).toEqual({ periodFrom: '2026-03-01', periodTo: '2026-04-01', health: ['healthy'] }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('treats an empty filtered portfolio as valid and reset restores data', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Сфера деятельности', ['Образование'])
    expect(await screen.findByText('Компании по выбранным фильтрам не найдены.')).toBeInTheDocument()
    expectKpi('Компании в портфеле', '0')
    expectKpi('Выручка портфеля', '—')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(await screen.findByText('Добавьте метрики, чтобы увидеть динамику выручки.')).toBeInTheDocument()
    await userEvent.setup().click(within(screen.getByRole('tabpanel')).getByRole('button', { name: 'Сбросить фильтры' }))
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    expectKpi('Выручка портфеля', '₽3 000')
    expect(screen.getByText('2026-01', { selector: 'tspan' })).toBeInTheDocument()
    expect(within(sidebar()).getByRole('button', { name: 'Сбросить фильтры' })).toBeDisabled()
  })

  it('reset clears all fields and statuses without reloading the page', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Компании', [alpha.name])
    await selectOptions('Сфера деятельности', ['Software as a Service'])
    await selectOptions('Состояние', ['В норме'])
    await selectOptions('Выполнение плана', ['Выполняет план'])
    fireEvent.change(within(sidebar()).getByLabelText('С'), { target: { value: '2026-01-01' } })
    fireEvent.change(within(sidebar()).getByLabelText('По'), { target: { value: '2026-02-28' } })
    await userEvent.setup().click(within(sidebar()).getByRole('button', { name: 'Сбросить фильтры' }))
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    expect(within(sidebar()).getByLabelText('С')).toHaveValue('')
    expect(within(sidebar()).getByLabelText('По')).toHaveValue('')
    expect(within(sidebar()).getByRole('button', { name: 'Сбросить фильтры' })).toBeDisabled()
    expect(screen.queryByText(/Активных групп фильтров/)).not.toBeInTheDocument()
  })

  it('keeps inactive data outside analytics filters and explains it', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Компании', [alpha.name])
    await selectOptions('Состояние', ['В норме'])
    await userEvent.setup().click(screen.getByRole('tab', { name: 'Неактивные (1)' }))
    expect(screen.getByText('Filter Inactive')).toBeInTheDocument()
    expect(screen.getByText('Аналитические фильтры применяются только к активному портфелю.')).toBeInTheDocument()
    expect(companiesApiMock.list.mock.calls.filter(([options]) => options.archived)).toHaveLength(1)
  })

  it('does not show previous chart series alongside newly loaded KPI', async () => {
    let resolvePerformance!: (value: typeof selectedPoints) => void
    dashboardApiMock.performance.mockImplementation((_months, { filters }) => filters.companyIds?.length
      ? new Promise(resolve => { resolvePerformance = resolve }) : Promise.resolve(allPoints))
    renderDashboard()
    await waitForInitial()
    await screen.findByText('2026-01', { selector: 'tspan' })
    await selectOptions('Компании', [alpha.name])
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expectKpi('Выручка портфеля', '₽1 200')
    expect(screen.queryByText('2026-01', { selector: 'tspan' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Выручка портфеля по месяцам' })).not.toBeInTheDocument()
    expect(screen.getByText('Обновляем данные по фильтрам…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Пригласить стартап' })).toBeInTheDocument()
    await act(async () => resolvePerformance(selectedPoints))
    expect(await screen.findByText('2026-02', { selector: 'tspan' })).toBeInTheDocument()
  })

  it('aborts superseded filter requests and ignores late responses', async () => {
    let resolveOld!: (value: DashboardResponse) => void
    let oldSignal!: AbortSignal
    dashboardApiMock.get.mockImplementation(({ filters, signal }) => filters.companyIds?.length === 1
      ? new Promise(resolve => { resolveOld = resolve; oldSignal = signal }) : Promise.resolve(full))
    renderDashboard()
    await waitForInitial()
    await selectOptions('Компании', [alpha.name])
    expect(screen.getByRole('tab', { name: 'Активные компании (2)' })).toBeInTheDocument()
    await selectOptions('Компании', [beta.name])
    await waitFor(() => expect(oldSignal.aborted).toBe(true))
    await act(async () => resolveOld(selected))
    expect(screen.getByRole('tab', { name: 'Активные компании (2)' })).toBeInTheDocument()
    expectKpi('Выручка портфеля', '₽3 000')
    expect(await screen.findByText('2026-01', { selector: 'tspan' })).toBeInTheDocument()
  })

  it('supports keyboard collapse, reopen and mobile Sheet closing with focus return', async () => {
    renderDashboard()
    await waitForInitial()
    const user = userEvent.setup()
    within(sidebar()).getByRole('button', { name: 'Свернуть фильтры' }).focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('complementary', { name: 'Фильтры' })).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Показать фильтры' }).focus()
    await user.keyboard('{Enter}')
    expect(sidebar()).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /^Фильтры$/ })
    trigger.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('dialog', { name: 'Фильтры' })).toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('С')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Закрыть фильтры' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps mobile menu focus inside the Sheet and Escape closes only the selection', async () => {
    renderDashboard()
    await waitForInitial()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Фильтры$/ }))
    const dialog = screen.getByRole('dialog')
    const selection = within(dialog).getByRole('button', { name: /^Компании:/ })
    selection.focus()
    await user.keyboard('{Enter}')
    const option = await screen.findByRole('menuitemcheckbox', { name: alpha.name })
    option.focus()
    expect(option).toHaveFocus()
    await user.keyboard(' ')
    expect(option).toHaveAttribute('aria-checked', 'true')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(selection).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Фильтры · 1$/ })).toHaveFocus()
  })

  it('synchronizes both summary datasets and resets excluded local selections without changing global filters', async () => {
    renderDashboard()
    await waitForInitial()
    const tables = ['План и факт по компаниям', 'Юнит-экономика компаний']
      .map(name => screen.getByRole('region', { name }))
    const user = userEvent.setup()
    const dashboardCalls = dashboardApiMock.get.mock.calls.length
    const performanceCalls = dashboardApiMock.performance.mock.calls.length
    for (const section of tables) {
      expect(within(within(section).getByRole('table')).getAllByRole('row')).toHaveLength(3)
      await user.click(within(section).getByRole('combobox', { name: 'Компания' }))
      await user.click(screen.getByRole('option', { name: beta.name }))
      expect(within(within(section).getByRole('table')).queryByRole('row', { name: `Открыть: ${alpha.name}` })).not.toBeInTheDocument()
    }
    await user.click(within(tables[0]).getByRole('button', { name: /^Показатели/ }))
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Выручка' }))
    await user.keyboard('{Escape}')
    expect(within(tables[1]).getByRole('button', { name: /^Показатели/ })).toHaveTextContent('3 / 3')
    expect(dashboardApiMock.get).toHaveBeenCalledTimes(dashboardCalls)
    expect(dashboardApiMock.performance).toHaveBeenCalledTimes(performanceCalls)
    expectKpi('Компании в портфеле', '2')
    await selectOptions('Сфера деятельности', ['Software as a Service'])
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    for (const section of tables) {
      const table = within(section).getByRole('table')
      expect(within(table).getByRole('row', { name: `Открыть: ${alpha.name}` })).toBeInTheDocument()
      expect(within(table).queryByRole('row', { name: `Открыть: ${beta.name}` })).not.toBeInTheDocument()
      expect(within(section).getByRole('combobox')).toHaveTextContent('Общий портфель')
    }
    expect(lastFilters()).toEqual({ industries: ['saas'] })
    expect(within(tables[0]).getByRole('button', { name: /^Показатели/ })).toHaveTextContent('3 / 4')
    await user.click(within(sidebar()).getByRole('button', { name: 'Сбросить фильтры' }))
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    for (const section of tables) expect(within(within(section).getByRole('table')).getAllByRole('row')).toHaveLength(3)
  })

  it('resets an empty summary through the shared E5 reset and opens its company row', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Сфера деятельности', ['Образование'])
    await screen.findByRole('tab', { name: 'Активные компании (0)' })
    for (const name of ['План и факт по компаниям', 'Юнит-экономика компаний']) {
      const section = screen.getByRole('region', { name })
      expect(within(section).getByText('По выбранным фильтрам компании не найдены.')).toBeInTheDocument()
      expect(within(section).queryByRole('table')).not.toBeInTheDocument()
    }
    const summary = screen.getByRole('region', { name: 'План и факт по компаниям' })
    await userEvent.setup().click(within(summary).getByRole('button', { name: 'Сбросить фильтры' }))
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    const row = within(within(summary).getByRole('table')).getByRole('row', { name: `Открыть: ${alpha.name}` })
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('Факт ₽1 200')
    expect(within(row).getAllByRole('cell')[0]).toHaveTextContent('План ₽1 000')
    fireEvent.click(within(row).getAllByRole('cell')[0])
    expectNavigationTo('/companies/alpha')
  })

  it('synchronizes company charts and E6 with company and date filters', async () => {
    dashboardApiMock.get.mockImplementation(({ filters }: { filters: DashboardFilters }) => {
      const response = responseFor(filters)
      return Promise.resolve(filters.periodTo ? {
        ...response, portfolioRevenue: 900,
        companies: [{ ...alpha, fact: { ...alpha.fact!, period: '2026-01-01', revenue: 900 },
          plan: { ...alpha.plan!, period: '2026-01-01', revenue: 950 } }],
      } : response)
    })
    renderDashboard()
    await waitForInitial()
    const bar = screen.getByRole('region', { name: 'План vs Факт по компаниям' })
    const donut = screen.getByRole('region', { name: 'Доля каждой компании в общей выручке портфеля' })
    const summary = screen.getByRole('region', { name: 'План и факт по компаниям' })
    expect(within(bar).getByRole('table')).toHaveTextContent(beta.name)
    expect(within(donut).getByText('₽1 800 · 60.0%')).toBeInTheDocument()
    await selectOptions('Компании', [alpha.name])
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(within(bar).getByRole('table')).not.toHaveTextContent(beta.name)
    expect(within(donut).getByText('₽1 200 · 100.0%')).toBeInTheDocument()
    fireEvent.change(within(sidebar()).getByLabelText('По'), { target: { value: '2026-01-31' } })
    await waitFor(() => expect(within(donut).getByText('₽900 · 100.0%')).toBeInTheDocument())
    expect(within(bar).getByRole('table')).toHaveTextContent('Январь 2026₽900₽950')
    const cell = within(within(within(summary).getByRole('table')).getByRole('row', { name: `Открыть: ${alpha.name}` })).getAllByRole('cell')[0]
    expect(cell).toHaveTextContent('Факт ₽900План ₽950')
    expectKpi('Выручка портфеля', '₽900')
    expect(dashboardApiMock.performance).toHaveBeenLastCalledWith(6, expect.objectContaining({
      filters: { companyIds: ['alpha'], periodTo: '2026-01-31' },
    }))
  })

  it('uses the shared global reset from an empty E7 chart', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Сфера деятельности', ['Образование'])
    await screen.findByRole('tab', { name: 'Активные компании (0)' })
    const donut = screen.getByRole('region', { name: 'Доля каждой компании в общей выручке портфеля' })
    expect(within(donut).getByText('Нет данных о выручке для расчёта долей.')).toBeInTheDocument()
    const bar = screen.getByRole('region', { name: 'План vs Факт по компаниям' })
    expect(within(bar).getByText('Нет данных о выручке для сравнения плана и факта.')).toBeInTheDocument()
    await userEvent.setup().click(within(donut).getByRole('button', { name: 'Сбросить фильтры' }))
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    expect(lastFilters()).toEqual({})
    expect(within(donut).getByText('₽1 800 · 60.0%')).toBeInTheDocument()
    expect(within(bar).getByRole('table')).toHaveTextContent(beta.name)
  })

  it('synchronizes industry profitability with global industry and date responses', async () => {
    dashboardApiMock.get.mockImplementation(({ filters }: { filters: DashboardFilters }) => {
      const response = responseFor(filters)
      return Promise.resolve(filters.periodTo ? { ...selected, portfolioRevenue: 900,
        companies: [{ ...alpha, fact: { ...alpha.fact!, period: '2026-01-01', revenue: 900 } }],
        profitabilityByIndustry: [{ industry: 'saas', revenue: 900, totalOpex: 990, ebitda: -90,
          ebitdaMargin: -0.1, companiesTotal: 1, companiesIncluded: 1 }],
      } : response)
    })
    renderDashboard()
    await waitForInitial()
    const region = screen.getByRole('region', { name: 'Прибыльность по сферам деятельности' })
    const table = within(region).getByRole('table')
    expect(table).toHaveTextContent('Software as a Service20.0%')
    expect(table).toHaveTextContent('Финтех−11.1%')
    await selectOptions('Сфера деятельности', ['Software as a Service'])
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(within(table).queryByRole('rowheader', { name: 'Финтех' })).not.toBeInTheDocument()
    fireEvent.change(within(sidebar()).getByLabelText('По'), { target: { value: '2026-01-31' } })
    await waitFor(() => expect(table).toHaveTextContent('Software as a Service−10.0%₽-90₽900₽990'))
    expectKpi('Выручка портфеля', '₽900')
    expect(within(screen.getByRole('region', { name: 'План и факт по компаниям' })).getByRole('table')).toHaveTextContent('Факт ₽900')
    expect(lastFilters()).toEqual({ industries: ['saas'], periodTo: '2026-01-31' })
  })

  it('resets an empty E8 result using the shared dashboard filter handler', async () => {
    renderDashboard()
    await waitForInitial()
    await selectOptions('Сфера деятельности', ['Образование'])
    await screen.findByRole('tab', { name: 'Активные компании (0)' })
    const region = screen.getByRole('region', { name: 'Прибыльность по сферам деятельности' })
    expect(within(region).getByText('Недостаточно фактических данных для расчёта прибыльности.')).toBeInTheDocument()
    await userEvent.setup().click(within(region).getByRole('button', { name: 'Сбросить фильтры' }))
    await screen.findByRole('tab', { name: 'Активные компании (2)' })
    expect(within(region).getByRole('table')).toHaveTextContent('Финтех−11.1%')
    expect(lastFilters()).toEqual({})
  })

})
