import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompaniesDashboard } from './CompaniesDashboard'
import type { CompanyStatusItem, DashboardResponse } from '@/types/api'
import type { ReactElement } from 'react'
import { useState } from 'react'
import { StartupInvite } from '@/components/common/StartupInvite'

// Keep real Recharts series/legend rendering; jsdom has no layout measurements.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement } = await import('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 256 }),
  }
})

const portfolioAI = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('@/api/portfolioInsights', () => ({ portfolioInsightsApi: portfolioAI }))
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
  user: { role: 'admin', productRole: 'fund', organizationId: 'org-1', companyId: null },
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

function renderInvite() {
  function Harness() {
    const [open, setOpen] = useState(false)
    return <><button onClick={() => setOpen(true)}>Пригласить стартап</button><StartupInvite open={open} onOpenChange={setOpen} /></>
  }
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><Harness /></QueryClientProvider>)
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

  it('Investor cannot navigate or mutate Active, Attention, Archived or summary rows', async () => {
    authStoreMock.user.productRole = 'investor'
    const archived = { id: 'archived', name: 'Archived startup', industry: 'saas', archivedAt: '2026-01-01' }
    companiesApiMock.list.mockImplementation(({ archived: inactive } = {}) => Promise.resolve(inactive ? [archived] : []))
    dashboardApiMock.get.mockResolvedValue({ ...response, companies: [{ ...company, attention: [{ kind: 'no_plan', label: 'No plan', severity: 'warning' }] }] })
    companiesApiMock.archive.mockClear(); companiesApiMock.restore.mockClear(); companiesApiMock.remove.mockClear()
    const view = renderDashboard()
    try {
      await screen.findByRole('tab', { name: 'Активные компании (1)' })
      const rows = screen.getAllByRole('row').filter(row => row.textContent?.includes(company.name))
      for (const row of rows) {
        expect(row).not.toHaveAttribute('tabindex')
        fireEvent.click(row); fireEvent.keyDown(row, { key: 'Enter' }); fireEvent.keyDown(row, { key: ' ' })
      }
      expect(screen.queryByRole('button', { name: 'Открыть' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Архивировать' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
      expect(screen.queryByText('ИИ-анализ портфеля')).not.toBeInTheDocument()
      await userEvent.setup().click(screen.getByRole('tab', { name: /^Требует внимания/ }))
      const attention = screen.getByRole('tabpanel')
      expect(within(attention).queryByRole('button')).not.toBeInTheDocument()
      fireEvent.click(within(attention).getByText(company.name))
      await userEvent.setup().click(screen.getByRole('tab', { name: /^Неактивные/ }))
      const name = await screen.findByText('Archived startup')
      fireEvent.click(name); fireEvent.keyDown(name.closest('li')!, { key: 'Enter' })
      expect(within(screen.getByRole('tabpanel')).queryByRole('button')).not.toBeInTheDocument()
      expect(navigateMock).not.toHaveBeenCalled()
      expect(companiesApiMock.archive).not.toHaveBeenCalled()
      expect(companiesApiMock.restore).not.toHaveBeenCalled()
      expect(companiesApiMock.remove).not.toHaveBeenCalled()
    } finally {
      view.unmount()
      authStoreMock.user.productRole = 'fund'
    }
  })

  it('keeps a six-card desktop grid without a filter sidebar', async () => {
    renderDashboard()
    const label = await screen.findByText('Компании в портфеле', { exact: true })
    const grid = label.closest('.grid')!
    expect(grid.children).toHaveLength(6)
    expect(grid).toHaveClass('min-[1366px]:grid-cols-6')
    for (const card of grid.children) expect(card).toHaveClass('min-w-0')
    expect(screen.queryByRole('complementary', { name: 'Фильтры' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument()
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

  it('formats fractional average runway without floating-point artifacts', async () => {
    dashboardApiMock.get.mockResolvedValue({ ...response, avgRunway: 0.8499999999999999 })
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(screen.getByText('0.8 мес.', { exact: true })).toBeInTheDocument()
    expect(screen.queryByText('0.8499999999999999 мес.', { exact: true })).not.toBeInTheDocument()
  })

  it('keeps Companies visible on catalog failure with industry slug fallback', async () => {
    catalogApiMock.get.mockRejectedValueOnce(new Error('Catalog unavailable'))
    renderDashboard()
    await screen.findByRole('tab', { name: 'Активные компании (1)' })
    expect(screen.getByRole('tab', { name: 'Активные компании (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument()
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

describe('Existing startup Invite dialog behavior', () => {
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
    renderInvite()
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

    renderInvite()
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

    renderInvite()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    fireEvent.click(screen.getByRole('button', { name: 'Создать ссылку' }))
    const linkInput = await screen.findByDisplayValue(/\/invite\/copy-token/)

    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }))

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkInput.getAttribute('value')),
    )
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
  })

  it('leaves the Companies page without its own Invite trigger', async () => {
    renderDashboard()
    await screen.findByRole('heading', { name: 'Портфель компаний', level: 1 })
    expect(screen.queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
    expect(screen.queryByText('Обзор всех стартапов акселератора')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Принудительный пересчёт|Пересчитывается/ })).not.toBeInTheDocument()
  })

  it('keeps invite loading and prevents duplicate create requests', async () => {
    let resolveInvite!: (value: { token: string }) => void
    invitesApiMock.create.mockImplementation(() => new Promise((resolve) => { resolveInvite = resolve }))
    renderInvite()
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
    renderInvite()
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
    renderInvite()
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

  it('offers no direct company creation or Invite in Companies content', async () => {
    renderDashboard()
    await screen.findByRole('heading', { name: 'Портфель компаний', level: 1 })
    expect(screen.queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
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

describe('Companies full-scope workspace', () => {
  beforeEach(() => {
    authStoreMock.user.productRole = 'fund'
    dashboardApiMock.get.mockReset().mockResolvedValue({ totalCompanies: 1, companies: [{ id: 'full', name: 'Full portfolio company', industry: 'saas', status: 'no_data', health: 'no_data', latestRevenue: null, latestPlanRevenue: null, revenueGrowth: null, runwayMonths: null, lastUpdate: null, geography: null, businessModel: null, attention: [], taskProgress: null }], profitabilityByIndustry: [] })
    dashboardApiMock.performance.mockReset().mockResolvedValue([])
    companiesApiMock.list.mockReset().mockResolvedValue([])
    catalogApiMock.get.mockReset().mockResolvedValue({ industries: [] })
    portfolioAI.generate.mockReset().mockResolvedValue({ scope: 'portfolio', provider: 'demo', text: 'Full scope' })
  })

  it('has six analytics charts and no filters, and always requests the default portfolio scope', async () => {
    renderDashboard()
    expect(await screen.findByRole('tab', { name: 'Активные компании (1)' })).toBeVisible()
    expect(screen.getByRole('group', { name: 'Графики компаний' }).querySelectorAll('h3')).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'Фильтры' })).not.toBeInTheDocument()
    expect(dashboardApiMock.get).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) })
    expect(dashboardApiMock.performance).toHaveBeenCalledWith(6, { signal: expect.any(AbortSignal) })
    const ai = screen.getByRole('heading', { name: 'ИИ-анализ портфеля' }).closest('section')!
    await userEvent.setup().click(within(ai).getByRole('button', { name: 'Сформировать анализ' }))
    await waitFor(() => expect(portfolioAI.generate).toHaveBeenCalledWith({}, expect.any(AbortSignal)))
  })
})
