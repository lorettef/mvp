import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore, type User } from '@/store/authStore'
import type { DashboardFilters } from '@/types/api'
import i18n from '@/i18n'
import { PortfolioAIInsight } from './PortfolioAIInsight'

const http = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/api/client', () => ({ api: http }))
const admin: User = { id: 'admin', organizationId: 'tenant-a', organizationType: 'fund', role: 'admin', companyId: null, email: '', fullName: '', companyName: '', subscriptionPlan: 'business', dailyLimit: null, usedToday: 0 }
const text = 'Проблема\nНет плана у одной компании.\n\nПричина\nПо доступным данным достоверно определить причину нельзя.\n\nДействие\nСверьте план компании.\nДедлайн: сегодня'
const isResult = (_: string, element: Element | null) => element?.tagName === 'P' && element.textContent === text
const response = { scope: 'portfolio', provider: 'demo', text }
const generate = () => screen.getByRole('button', { name: 'Сформировать анализ' })
beforeEach(async () => {
  await i18n.changeLanguage('ru')
  useAuthStore.getState().setUser(admin)
  http.post.mockReset().mockResolvedValue({ data: response })
})
afterEach(() => { cleanup(); useAuthStore.getState().setUser(null) })

describe('Portfolio AI', () => {
  it('generates only on demand via one portfolio endpoint, never sends company rows', async () => {
    render(<PortfolioAIInsight />)
    expect(screen.getByRole('heading', { name: 'ИИ-анализ портфеля' })).toBeVisible()
    expect(http.post).not.toHaveBeenCalled()
    fireEvent.click(generate())
    expect(await screen.findByText(isResult)).toBeVisible()
    expect(http.post).toHaveBeenCalledTimes(1)
    const [path, body, options] = http.post.mock.calls[0]
    expect(path).toBe('/insights/portfolio')
    expect(body).toBeUndefined()
    expect([...options.params.entries()]).toEqual([])
    expect(options.signal).toBeInstanceOf(AbortSignal)
    expect(screen.getByText(isResult)).toHaveClass('whitespace-pre-wrap', '[overflow-wrap:anywhere]')
  })

  it('uses the exact canonical dashboard filter query format and all supported filters', async () => {
    const filters: DashboardFilters = { companyIds: ['b', 'a', 'a'], industries: ['saas'], health: ['critical'], performanceStatus: ['behind'], periodFrom: '2026-01-01', periodTo: '2026-03-31' }
    render(<PortfolioAIInsight filters={filters} />)
    fireEvent.click(generate())
    await screen.findByText(isResult)
    expect([...http.post.mock.calls[0][2].params.entries()]).toEqual([
      ['company_id', 'a'], ['company_id', 'b'], ['industry', 'saas'], ['health', 'critical'],
      ['performance_status', 'behind'], ['period_from', '2026-01-01'], ['period_to', '2026-03-31'],
    ])
  })

  it('clears result for changed scope, retains it for reordered equivalent filters', async () => {
    const { rerender } = render(<PortfolioAIInsight filters={{ companyIds: ['a', 'b'] }} />)
    fireEvent.click(generate())
    await screen.findByText(isResult)
    rerender(<PortfolioAIInsight filters={{ companyIds: ['b', 'a', 'a'] }} />)
    expect(screen.getByText(isResult)).toBeVisible()
    rerender(<PortfolioAIInsight filters={{ companyIds: ['b'] }} />)
    expect(screen.queryByText(isResult)).not.toBeInTheDocument()
    expect(http.post).toHaveBeenCalledTimes(1) // No automatic regeneration.
    fireEvent.click(generate())
    await screen.findByText(isResult)
    expect([...http.post.mock.calls[1][2].params.entries()]).toEqual([['company_id', 'b']])
  })

  it('aborts stale generation on filter change, ignores old response and allows new generation', async () => {
    let resolve!: (value: unknown) => void
    http.post.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const { rerender } = render(<PortfolioAIInsight filters={{ industries: ['saas'] }} />)
    fireEvent.click(generate())
    const signal = http.post.mock.calls[0][2].signal as AbortSignal
    rerender(<PortfolioAIInsight filters={{ industries: ['fintech'] }} />)
    expect(signal.aborted).toBe(true)
    await act(async () => resolve({ data: { ...response, text: 'OLD SCOPE' } }))
    expect(screen.queryByText('OLD SCOPE')).not.toBeInTheDocument()
    fireEvent.click(generate())
    expect(await screen.findByText(isResult)).toBeVisible()
  })

  it('protects pending generation from duplicate clicks and identifies refresh of previous result', async () => {
    render(<PortfolioAIInsight />)
    fireEvent.click(generate())
    await screen.findByText(isResult)
    let resolve!: (value: unknown) => void
    http.post.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    fireEvent.click(generate())
    const pending = screen.getByRole('button', { name: 'Анализ...' })
    expect(pending).toBeDisabled()
    fireEvent.click(pending)
    expect(http.post).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status')).toHaveTextContent('предыдущий результат')
    expect(screen.getByText(isResult)).toBeVisible()
    await act(async () => resolve({ data: response }))
    expect(generate()).toBeEnabled()
  })

  it('shows a human-readable error and retries with exactly one new POST', async () => {
    http.post.mockRejectedValueOnce({ response: { data: { detail: { secret: 'raw exception' } } } })
    render(<PortfolioAIInsight />)
    fireEvent.click(generate())
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сформировать анализ портфеля')
    expect(screen.queryByText('raw exception')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    await screen.findByText(isResult)
    expect(http.post).toHaveBeenCalledTimes(2)
  })

  it('resets identity on tenant change and ignores old tenant response', async () => {
    let resolve!: (value: unknown) => void
    http.post.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    render(<PortfolioAIInsight />)
    fireEvent.click(generate())
    act(() => useAuthStore.getState().setUser({ ...admin, organizationId: 'tenant-b' }))
    await act(async () => resolve({ data: { ...response, text: 'OTHER TENANT' } }))
    expect(screen.queryByText('OTHER TENANT')).not.toBeInTheDocument()
    expect(generate()).toBeEnabled()
  })

  it.each([{ role: 'company' }, { role: 'observer' }, { organizationType: 'startup' }])('hides generation for prohibited context %j', async (override) => {
    useAuthStore.getState().setUser({ ...admin, ...override })
    render(<PortfolioAIInsight />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(http.post).not.toHaveBeenCalled()
  })

  it('localizes UI labels without changing generation language/API', async () => {
    await i18n.changeLanguage('en')
    render(<PortfolioAIInsight />)
    expect(screen.getByRole('heading', { name: 'Portfolio AI analysis' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Generate analysis' }))
    await waitFor(() => expect(screen.getByText(isResult)).toBeVisible())
  })
})
