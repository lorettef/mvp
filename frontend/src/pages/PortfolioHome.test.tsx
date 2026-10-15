import { useAuthStore } from '@/store/authStore'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DashboardResponse } from '@/types/api'
import { qk } from '@/lib/queryKeys'
import i18n from '@/i18n'
import { PortfolioHome } from './PortfolioHome'

const portfolioAI = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('@/api/portfolioInsights', () => ({ portfolioInsightsApi: portfolioAI }))
const http = vi.hoisted(() => ({ get: vi.fn() }))
// Mock only the existing HTTP transport, retaining dashboardApi paths/options.
vi.mock('@/api/client', () => ({ api: { get: http.get } }))
vi.mock('@/auth/authSession', () => ({ getTenantKey: () => 'org-home' }))
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement } = await import('react')
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 256 }) }
})

const response: DashboardResponse = { totalCompanies: 10, avgRevenue: 100, avgCac: 2, avgLtv: 100, avgChurn: 0.1,
  portfolioRevenue: 100, revenueGrowth: 0, companiesAtRisk: 0, avgRunway: 8, companiesWithoutData: 6,
  onTrack: 1, behind: 1, noPlan: 2, noData: 6,
  companies: [{ id: 'c1', name: 'Acme', industry: 'saas', geography: 'RU', businessModel: 'subscription',
    status: 'on_track', latestRevenue: 100, latestPlanRevenue: 90, revenueGrowth: 0, runwayMonths: 8,
    lastUpdate: '2026-09-01', health: 'healthy', attention: [], taskProgress: 0,
    fact: { period: '2026-09-01', revenue: 100, newUnits: 10, arpu: 10, marketingSpend: 20, retentionRate: 0.9, cac: 2, ltv: 100, churn: 0.1 },
    plan: null }],
  profitabilityByIndustry: [{ industry: 'saas', revenue: 100, totalOpex: 80, ebitda: 20, ebitdaMargin: 0.2, companiesTotal: 1, companiesIncluded: 1 }],
}
const performance = [{ month: '2026-09', fact: 100, plan: 90 }]
const titles = ['Выручка портфеля', 'Доля каждой компании в общей выручке портфеля', 'План vs Факт по компаниям', 'Прибыльность по сферам деятельности']
const clients: QueryClient[] = []
function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  // A Companies-filtered result must never become the unfiltered Main snapshot.
  client.setQueryData(qk.dashboard('org-home', { companyIds: ['other'] }), { ...response, totalCompanies: 999 })
  return { client, ...render(<QueryClientProvider client={client}><PortfolioHome /></QueryClientProvider>) }
}
function slot(number: number) { return screen.getByRole('group', { name: `График ${number}` }) }
async function selectVariant(number: number, title: string) {
  await userEvent.setup().click(within(slot(number)).getByRole('button', { name: 'Сменить вариант графика' }))
  const menu = screen.getByRole('menu')
  expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(4)
  await userEvent.setup().click(within(menu).getByRole('menuitemradio', { name: title }))
}
beforeEach(async () => {
  await i18n.changeLanguage('ru')
  http.get.mockReset().mockImplementation((path: string) => {
    if (path === '/dashboard') return Promise.resolve({ data: response })
    if (path === '/dashboard/performance') return Promise.resolve({ data: performance })
    throw new Error(`Unexpected endpoint: ${path}`)
  })
})
afterEach(() => { act(() => useAuthStore.getState().setUser(null)); clients.splice(0).forEach((client) => client.clear()) })

describe('Portfolio Home', () => {
  it('places one default-scope portfolio AI after the two chart slots, with no automatic generation', async () => {
    useAuthStore.getState().setUser({ id: 'fund', role: 'admin', organizationId: 'org-home', companyId: null, organizationType: 'fund', email: '', fullName: '', companyName: '', subscriptionPlan: 'pro', dailyLimit: null, usedToday: 0 })
    portfolioAI.generate.mockReset().mockResolvedValue({ scope: 'portfolio', provider: 'demo', text: 'Проблема\nДанных мало.\nПричина\nПричина неизвестна.\nДействие\nПроверьте данные.\nДедлайн: сегодня' })
    renderHome()
    await screen.findByText('Компании в портфеле')
    const ai = screen.getByRole('heading', { name: 'ИИ-анализ портфеля' }).closest('section')!
    expect(slot(2).compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ai.parentElement?.lastElementChild).toBe(ai)
    expect(portfolioAI.generate).not.toHaveBeenCalled()
    fireEvent.click(within(ai).getByRole('button', { name: 'Сформировать анализ' }))
    await waitFor(() => expect(portfolioAI.generate).toHaveBeenCalledOnce())
    expect(portfolioAI.generate).toHaveBeenCalledWith({}, expect.any(AbortSignal))
    expect(screen.getAllByRole('button', { name: 'Сменить вариант графика' })).toHaveLength(2)
  })

  it('renders six KPI and exactly two default slots without Companies management', async () => {
    const { container } = renderHome()
    const label = await screen.findByText('Компании в портфеле')
    const grid = label.closest('.grid')!
    expect(grid.children).toHaveLength(6)
    expect(grid).toHaveClass('min-[1366px]:grid-cols-6')
    expect(screen.getByRole('heading', { name: 'Главная' })).toBeVisible()
    expect(screen.getByText('50%')).toBeVisible() // Only the two companies with a comparable plan.
    expect(screen.queryByText('999', { exact: true })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Сменить вариант графика' })).toHaveLength(2)
    expect(within(slot(1)).getByRole('heading', { name: titles[0] })).toBeVisible()
    expect(within(slot(2)).getByRole('heading', { name: titles[1] })).toBeVisible()
    expect(slot(1).querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect(slot(2).querySelector('.recharts-pie')).toBeInTheDocument()
    expect(container.querySelector('aside')).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'План и факт по компаниям' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Юнит-экономика компаний' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
  })

  it('uses only the existing unfiltered dashboard and six-month performance requests', async () => {
    renderHome()
    await screen.findByText('Компании в портфеле')
    expect(http.get.mock.calls.map(([path]) => path)).toEqual(['/dashboard', '/dashboard/performance'])
    const dashboardOptions = http.get.mock.calls[0][1]
    expect(dashboardOptions.signal).toBeInstanceOf(AbortSignal)
    expect([...dashboardOptions.params.entries()]).toEqual([])
    expect([...http.get.mock.calls[1][1].params.entries()]).toEqual([['months', '6']])
    await selectVariant(1, titles[3])
    expect(http.get).toHaveBeenCalledTimes(2)
  })

  it('switches all four variants independently and allows identical selections', async () => {
    renderHome()
    await screen.findByText('Компании в портфеле')
    for (const title of titles) {
      await selectVariant(1, title)
      expect(within(slot(1)).getAllByRole('heading')).toHaveLength(1) // No nested Section shell.
      expect(within(slot(1)).getByRole('heading', { name: title })).toBeVisible()
      expect(within(slot(2)).getByRole('heading', { name: titles[1] })).toBeVisible()
    }
    expect(slot(1).querySelector('.recharts-reference-line')).toBeInTheDocument()
    await selectVariant(2, titles[3])
    expect(within(slot(2)).getByRole('heading', { name: titles[3] })).toBeVisible()
    expect(within(slot(1)).getByRole('heading', { name: titles[3] })).toBeVisible()
    await selectVariant(2, titles[2])
    expect(within(slot(2)).getByRole('table', { name: titles[2] })).toHaveTextContent('Acme')
    expect(within(slot(1)).getByRole('heading', { name: titles[3] })).toBeVisible()
  })

  it('supports keyboard radio selection and returns focus to the switcher', async () => {
    renderHome()
    await screen.findByText('Компании в портфеле')
    const user = userEvent.setup()
    const trigger = within(slot(1)).getByRole('button', { name: 'Сменить вариант графика' })
    act(() => trigger.focus())
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menu')).toBeVisible()
    await user.keyboard('{End}{Enter}')
    expect(within(slot(1)).getByRole('heading', { name: titles[3] })).toBeVisible()
    await waitFor(() => expect(trigger).toHaveFocus())
  })

  it('isolates performance failure and retries only its existing endpoint', async () => {
    let fail = true
    http.get.mockImplementation((path: string) => path === '/dashboard'
      ? Promise.resolve({ data: response })
      : fail ? Promise.reject(new Error('Performance failed')) : Promise.resolve({ data: performance }))
    renderHome()
    expect(await within(slot(1)).findByRole('alert')).toHaveTextContent('Performance failed')
    expect(await screen.findByText('Компании в портфеле')).toBeVisible()
    expect(slot(2).querySelector('.recharts-pie')).toBeInTheDocument()
    fail = false
    fireEvent.click(within(slot(1)).getByRole('button', { name: 'Повторить' }))
    await waitFor(() => expect(slot(1).querySelectorAll('.recharts-bar')).toHaveLength(2))
    expect(http.get.mock.calls.filter(([path]) => path === '/dashboard')).toHaveLength(1)
  })

  it('keeps performance available while dashboard loading or failure affects only dependent sections', async () => {
    let rejectDashboard!: (error: Error) => void
    http.get.mockImplementation((path: string) => path === '/dashboard'
      ? new Promise((_resolve, reject) => { rejectDashboard = reject })
      : Promise.resolve({ data: performance }))
    renderHome()
    await waitFor(() => expect(slot(1).querySelectorAll('.recharts-bar')).toHaveLength(2))
    expect(within(slot(2)).getByTestId('query-state-loading')).toBeVisible()
    act(() => rejectDashboard(new Error('Dashboard failed')))
    expect(await within(slot(2)).findByRole('alert')).toHaveTextContent('Dashboard failed')
    expect(slot(1).querySelectorAll('.recharts-bar')).toHaveLength(2)
  })

  it('preserves unavailable KPI help and empty charts without fake zeros', async () => {
    http.get.mockImplementation((path: string) => Promise.resolve({ data: path === '/dashboard'
      ? { ...response, portfolioRevenue: null, revenueGrowth: null, avgRunway: null, onTrack: 0, behind: 0, companies: [], profitabilityByIndustry: [] }
      : [] }))
    renderHome()
    const help = await screen.findByRole('button', { name: 'Выручка портфеля' })
    fireEvent.click(help)
    expect(await screen.findByRole('dialog', { name: 'Выручка портфеля' })).toHaveTextContent('нет фактических данных')
    expect(within(slot(1)).getByText('Добавьте метрики, чтобы увидеть динамику выручки.')).toBeVisible()
    expect(within(slot(2)).getByText('Нет данных о выручке для расчёта долей.')).toBeVisible()
  })

  it('reuses cached catalog labels without making a catalog request', async () => {
    const { client } = renderHome()
    act(() => client.setQueryData(['catalog'], { industries: [{ slug: 'saas', label: 'SaaS' }] }))
    await screen.findByText('Компании в портфеле')
    await selectVariant(1, titles[3])
    expect(within(slot(1)).getByRole('rowheader', { name: 'SaaS' })).toBeVisible()
    expect(http.get.mock.calls.every(([path]) => path.startsWith('/dashboard'))).toBe(true)
  })

  it('localizes Home, slot titles and switcher in English', async () => {
    await i18n.changeLanguage('en')
    renderHome()
    expect(await screen.findByRole('heading', { name: 'Home' })).toBeVisible()
    expect(screen.getAllByRole('button', { name: 'Switch chart type' })).toHaveLength(2)
    expect(screen.getByRole('group', { name: 'Chart 1' })).toHaveTextContent('Portfolio revenue')
  })
})
