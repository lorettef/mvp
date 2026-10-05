import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps, ReactElement } from 'react'
import type { CompanyStatusItem, DashboardMetricSnapshot } from '@/types/api'
import { CompanyRevenueComparisonChart, CompanyRevenueTooltip } from './CompanyRevenueComparisonChart'
import { CompanyRevenueShareChart } from './CompanyRevenueShareChart'
import { companyRevenueColor, companyRevenuePoints, companyRevenueShares } from './companyRevenue'
import { PortfolioPlanFactTable } from './PortfolioSummaryTables'
import { fmtRub } from '@/lib/format'

const spies = vi.hoisted(() => ({ bar: vi.fn(), pie: vi.fn() }))
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement, createElement, Children } = await import('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 300 }),
    BarChart: (props: ComponentProps<typeof actual.BarChart>) => {
      spies.bar(props.data)
      return createElement(actual.BarChart, props)
    },
    PieChart: (props: ComponentProps<typeof actual.PieChart>) => {
      const pie = Children.toArray(props.children).find(child => (child as ReactElement).type === actual.Pie) as ReactElement
      spies.pie(pie.props.data)
      return createElement(actual.PieChart, props)
    },
  }
})

const snapshot: DashboardMetricSnapshot = {
  period: '2026-09-01', revenue: 1200, newUnits: 100, arpu: 12, marketingSpend: 200,
  retentionRate: 0.9, churn: 0.1, ltv: 120, cac: 2,
}
function company(id: string, revenue: number | null, planned: number | null = null): CompanyStatusItem {
  return {
    id, name: `Компания ${id}`, industry: 'fintech', geography: null, businessModel: 'subscription',
    status: 'no_plan', health: 'healthy', latestRevenue: 999999, latestPlanRevenue: 888888,
    revenueGrowth: null, runwayMonths: null, lastUpdate: '2026-10-01', attention: [], taskProgress: null,
    fact: revenue === null ? null : { ...snapshot, revenue },
    plan: planned === null ? null : { ...snapshot, revenue: planned },
  }
}
const comparisonTitle = 'План vs Факт по компаниям'
const shareTitle = 'Доля каждой компании в общей выручке портфеля'
const companies = [company('a', 1200, 1500), company('b', 1800), company('zero', 0, 0), company('missing', null)]
beforeEach(() => { spies.bar.mockClear(); spies.pie.mockClear() })

describe('CompanyRevenueComparisonChart', () => {
  it('renders grouped Fact/Plan bars in response order from structured snapshots', () => {
    const { container } = render(<CompanyRevenueComparisonChart companies={companies} />)
    expect(spies.bar).toHaveBeenCalledWith(companyRevenuePoints(companies))
    expect(spies.bar.mock.calls[0][0].map((point: { id: string }) => point.id)).toEqual(['a', 'b', 'zero', 'missing'])
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect([...container.querySelectorAll('.recharts-legend-item')].map(item => item.textContent)).toEqual(['Факт', 'План'])
    expect(container.querySelector('.recharts-line')).not.toBeInTheDocument()
    expect(screen.getByRole('table')).not.toHaveTextContent('999 999')
  })

  it.each([
    ['missing Plan', company('p', 100), 100, null],
    ['missing Fact', company('f', null, 200), null, 200],
    ['real zero', company('z', 0, 0), 0, 0],
  ])('preserves %s in the dataset', (_label, item, fact, plan) => {
    render(<CompanyRevenueComparisonChart companies={[item]} />)
    expect(spies.bar.mock.calls[0][0][0]).toMatchObject({ fact, plan })
    const cells = within(screen.getByRole('table')).getAllByRole('cell')
    expect(cells[1]).toHaveTextContent(fmtRub(fact as number | null))
    expect(cells[2]).toHaveTextContent(fmtRub(plan as number | null))
  })

  it('tooltip shows full name, matching Fact period, both values and missing Plan', () => {
    render(<CompanyRevenueTooltip active payload={[{ payload: companyRevenuePoints([companies[1]])[0] }]} />)
    expect(screen.getByText(companies[1].name)).toBeInTheDocument()
    expect(screen.getByText('Сентябрь 2026')).toBeInTheDocument()
    expect(screen.getByText(/Факт:/)).toHaveTextContent('Факт: ₽1 800')
    expect(screen.getByText(/План:/)).toHaveTextContent('План: —')
  })

  it('tooltip preserves real zero and explains missing Fact instead of using lastUpdate', () => {
    const { rerender } = render(<CompanyRevenueTooltip active payload={[{ payload: companyRevenuePoints([companies[2]])[0] }]} />)
    expect(screen.getByText(/Факт:/)).toHaveTextContent('Факт: ₽0')
    rerender(<CompanyRevenueTooltip active payload={[{ payload: companyRevenuePoints([companies[3]])[0] }]} />)
    expect(screen.getByText('Нет фактических данных')).toBeInTheDocument()
    expect(screen.getByText(/Факт:/)).toHaveTextContent('Факт: —')
  })

  it('retains long full names in accessible data and tooltip while shortening ticks', () => {
    const item = { ...companies[0], name: 'Очень длинное название компании для проверки подписи' }
    render(<CompanyRevenueComparisonChart companies={[item]} />)
    expect(within(screen.getByRole('table')).getByRole('rowheader', { name: item.name })).toBeInTheDocument()
    expect(screen.getByText('Очень длинное н…', { selector: 'tspan' })).toBeInTheDocument()
    render(<CompanyRevenueTooltip active payload={[{ payload: companyRevenuePoints([item])[0] }]} />)
    expect(screen.getByText(item.name, { selector: 'p' })).toBeInTheDocument()
  })

  it('replaces data with the global filtered dataset without extra selection state', () => {
    const { rerender } = render(<CompanyRevenueComparisonChart companies={companies} />)
    rerender(<CompanyRevenueComparisonChart companies={[companies[0]]} />)
    expect(spies.bar).toHaveBeenLastCalledWith(companyRevenuePoints([companies[0]]))
    expect(screen.getByRole('table')).not.toHaveTextContent(companies[1].name)
  })

  it.each([{ items: [] }, { items: [companies[3]] }])('explains empty/all-missing data without inventing bars', ({ items }) => {
    render(<CompanyRevenueComparisonChart companies={items} />)
    expect(screen.getByText('Нет данных о выручке для сравнения плана и факта.')).toBeInTheDocument()
    expect(spies.bar).not.toHaveBeenCalled()
  })

  it('provides a keyboard-focusable internal scroll area for 15+ companies', () => {
    render(<CompanyRevenueComparisonChart companies={Array.from({ length: 16 }, (_, i) => company(String(i), i * 100))} />)
    expect(screen.getByRole('group', { name: comparisonTitle })).toHaveAttribute('tabindex', '0')
    expect(spies.bar.mock.calls[0][0]).toHaveLength(16)
  })
})

describe('CompanyRevenueShareChart', () => {
  it('calculates the denominator and raw shares from non-null Fact only', () => {
    const result = companyRevenueShares(companies)
    expect(result.total).toBe(3000)
    expect(result.data.map(point => point.share)).toEqual([0.4, 0.6, 0])
    expect(result.data.reduce((sum, point) => sum + point.share, 0)).toBeCloseTo(1, 12)
    expect(result.data.map(point => point.id)).toEqual(['a', 'b', 'zero'])
  })

  it('shows companies, revenue and percentage in the legend, with a correct center count including zero', () => {
    render(<CompanyRevenueShareChart companies={companies} />)
    const legend = screen.getByRole('list', { name: 'Выручка и доли компаний' })
    expect(within(legend).getAllByRole('listitem')).toHaveLength(3)
    expect(legend).toHaveTextContent('Компания a₽1 200 · 40.0%')
    expect(legend).toHaveTextContent('Компания b₽1 800 · 60.0%')
    expect(legend).toHaveTextContent('Компания zero₽0 · 0.0%')
    expect(legend).not.toHaveTextContent('fintech')
    expect(legend).not.toHaveTextContent(companies[3].name)
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('компании')).toBeInTheDocument()
    expect(screen.getByText(/Общая фактическая выручка:/)).toHaveTextContent('₽3 000')
    expect(spies.pie.mock.calls[0][0].map((point: { revenue: number }) => point.revenue)).toEqual([1200, 1800, 0])
  })

  it('keeps colors stable across ordering, filtering and rerenders', () => {
    const original = companyRevenueShares(companies).data
    const reversed = companyRevenueShares([...companies].reverse()).data
    for (const point of original) {
      expect(reversed.find(item => item.id === point.id)?.color).toBe(point.color)
      expect(companyRevenueColor(point.id)).toBe(point.color)
    }
  })

  it('rounds displayed percentages without altering raw shares', () => {
    const thirds = ['a', 'b', 'c'].map(id => company(id, 1))
    render(<CompanyRevenueShareChart companies={thirds} />)
    expect(screen.getAllByText('₽1 · 33.3%')).toHaveLength(3)
    expect(companyRevenueShares(thirds).data.reduce((sum, point) => sum + point.share, 0)).toBeCloseTo(1)
  })

  it.each([{ items: [] }, { items: [companies[3]] }, { items: [company('zero', 0)] }])('renders an honest empty state for empty/missing/all-zero revenue', ({ items }) => {
    render(<CompanyRevenueShareChart companies={items} />)
    expect(screen.getByText('Нет данных о выручке для расчёта долей.')).toBeInTheDocument()
    expect(spies.pie).not.toHaveBeenCalled()
  })

  it('uses the filtered dataset for denominator, legend and singular count', () => {
    const { rerender } = render(<CompanyRevenueShareChart companies={companies} />)
    rerender(<CompanyRevenueShareChart companies={[companies[0]]} />)
    expect(screen.getByText('₽1 200 · 100.0%')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('компания')).toBeInTheDocument()
    expect(screen.queryByText(companies[1].name)).not.toBeInTheDocument()
    expect(spies.pie.mock.calls[spies.pie.mock.calls.length - 1][0]).toHaveLength(1)
  })

  it('calls the existing global reset when filters produce no companies', () => {
    const reset = vi.fn()
    render(<CompanyRevenueShareChart companies={[]} onResetFilters={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})

it('keeps E6 Fact/Plan cells, company bar values and donut contributions consistent', () => {
  render(<><PortfolioPlanFactTable companies={companies} onOpen={vi.fn()} />
    <CompanyRevenueComparisonChart companies={companies} /><CompanyRevenueShareChart companies={companies} /></>)
  const table = within(screen.getByRole('region', { name: 'План и факт по компаниям' })).getByRole('table')
  const barData = spies.bar.mock.calls[0][0] as ReturnType<typeof companyRevenuePoints>
  const donutData = spies.pie.mock.calls[0][0] as ReturnType<typeof companyRevenueShares>['data']
  for (const item of companies) {
    const revenueCell = within(within(table).getByRole('row', { name: `Открыть: ${item.name}` })).getAllByRole('cell')[0]
    const bar = barData.find(point => point.id === item.id)!
    expect(revenueCell).toHaveTextContent(`Факт ${fmtRub(bar.fact).replace(/\u00a0/g, ' ')}`)
    expect(revenueCell).toHaveTextContent(`План ${fmtRub(bar.plan).replace(/\u00a0/g, ' ')}`)
    if (bar.fact !== null) expect(donutData.find(point => point.id === item.id)?.revenue).toBe(bar.fact)
    else expect(donutData.find(point => point.id === item.id)).toBeUndefined()
  }
  expect(within(screen.getByRole('region', { name: shareTitle })).getByText(/Общая фактическая выручка:/))
    .toHaveTextContent(fmtRub(donutData.reduce((sum, point) => sum + point.revenue, 0)).replace(/\u00a0/g, ' '))
})
