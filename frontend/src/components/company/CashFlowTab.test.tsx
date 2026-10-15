import { render, screen, fireEvent, within } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import type { ReactElement } from 'react'
import { CashFlowTab } from './CashFlowTab'
import { PnLEbitdaChart } from './PnLEbitdaChart'
import { CompanyCashFlowChart } from './CompanyProfileCharts'
import type { CashFlowMonth, CashFlowResponse, PnLPeriod, PnLScenario } from '@/types/api'
import i18n from '@/i18n'

const charts = vi.hoisted(() => ({ bars: vi.fn(), composed: vi.fn() }))
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement } = await import('react')
  return { ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 288 }),
    BarChart: (props: Parameters<typeof actual.BarChart>[0]) => { charts.bars(props); return <actual.BarChart {...props} /> },
    ComposedChart: (props: Parameters<typeof actual.ComposedChart>[0]) => { charts.composed(props); return <actual.ComposedChart {...props} /> },
  }
})
const month = (period: string, extra: Partial<CashFlowMonth> = {}): CashFlowMonth => ({
  period, netProfit: 50, operatingCf: 50, investingCf: 0, financingCf: 100, totalCf: 150, netCashFlow: 150, closingBalance: 200, ...extra,
})
const months = [month('2026-03-01', { netCashFlow: -90, closingBalance: -20 }), month('2026-01-01', { netCashFlow: 0 }), month('2026-02-01', { netCashFlow: null, closingBalance: null })]
const response = { companyId: 'c1', months, summary: 'obsolete summary' } as CashFlowResponse
const scenario = (ebitda: number | null) => ({ ebitda } as PnLScenario)
beforeEach(() => { charts.bars.mockClear(); charts.composed.mockClear(); void i18n.changeLanguage('ru') })

describe('Cash Flow single-value matrix', () => {
  it('renders seven article rows and chronological horizontal months, without scenarios or source actions', () => {
    const original = months.map(m => ({ ...m }))
    render(<CashFlowTab data={response} />)
    const matrix = within(screen.getByTestId('cashflow-desktop'))
    expect(matrix.getAllByRole('columnheader').map(c => c.textContent)).toEqual(['Статья', 'Январь 2026', 'Февраль 2026', 'Март 2026'])
    expect(matrix.getAllByRole('rowheader').map(c => c.textContent)).toEqual(['Чистая прибыль', 'Денежный поток от основной деятельности', 'Инвестиционный денежный поток', 'Финансовый денежный поток', 'Общий денежный поток', 'Чистый денежный поток', 'Остаток денежных средств'])
    expect(matrix.getAllByRole('cell')).toHaveLength(21)
    const row = matrix.getByRole('rowheader', { name: 'Чистый денежный поток' }).closest('tr')!
    expect(within(row).getAllByRole('cell').map(c => c.textContent)).toEqual(['₽0', '—', '₽-90'])
    for (const label of ['План', 'Факт', 'Plan', 'Fact', 'Actual', 'obsolete summary', 'Амортизация', 'CAPEX']) expect(screen.queryByText(label)).not.toBeInTheDocument()
    expect(matrix.queryByRole('button')).not.toBeInTheDocument()
    for (const cell of matrix.getAllByRole('cell')) { fireEvent.doubleClick(cell); fireEvent.keyDown(cell, { key: 'Enter' }) }
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(months).toEqual(original)
  })
  it('uses sticky first column and internal scroll; chart precedes matrix', () => {
    render(<CashFlowTab data={response} />)
    const desktop = screen.getByTestId('cashflow-desktop')
    expect(desktop).toHaveClass('min-w-0', 'max-w-full', 'overflow-x-auto')
    expect(within(desktop).getAllByRole('rowheader')[0]).toHaveClass('sticky', 'left-0')
    const chart = screen.getByRole('region', { name: 'Денежный поток и остаток' })
    expect(chart.compareDocumentPosition(desktop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('mobile selects latest month and renders only Article/Value with negative and missing values', () => {
    render(<CashFlowTab data={response} />)
    const selector = screen.getByRole('combobox', { name: 'Период' })
    const mobile = within(screen.getByTestId('cashflow-mobile'))
    expect(selector).toHaveValue('2026-03-01')
    expect(mobile.getAllByRole('columnheader').map(c => c.textContent)).toEqual(['Статья', 'Значение'])
    expect(mobile.getAllByRole('cell')).toHaveLength(7)
    expect(mobile.getByText('₽-20')).toBeInTheDocument()
    fireEvent.change(selector, { target: { value: '2026-02-01' } })
    expect(mobile.getAllByText('—')).toHaveLength(2)
  })
  it('renders loading and empty states without obsolete summary cards', () => {
    const view = render(<CashFlowTab isLoading />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    view.rerender(<CashFlowTab />)
    expect(screen.getByText('Данные Cash Flow ещё не рассчитаны.')).toBeInTheDocument()
    view.rerender(<CashFlowTab data={{ ...response, months: [] }} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
  it('translates the single-value matrix', async () => {
    await i18n.changeLanguage('en')
    render(<CashFlowTab data={response} />)
    expect(screen.getByRole('table', { name: 'Cash Flow: items by month' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Value' })).toBeInTheDocument()
    expect(screen.getAllByRole('rowheader', { name: 'Operating cash flow' })).toHaveLength(2)
  })
})

describe('Module financial charts', () => {
  it('renders grouped EBITDA bars from paired periods only, retaining nulls, zero and future Plan chronologically', () => {
    const periods: PnLPeriod[] = [
      { period: '2027-01-01', plan: scenario(60), fact: null },
      { period: '2026-03-01', plan: null, fact: scenario(-30) },
      { period: '2026-01-01', plan: scenario(0), fact: scenario(10) },
      { period: '2026-02-01', plan: scenario(null), fact: scenario(null) },
    ]
    render(<PnLEbitdaChart periods={periods} />)
    const props = charts.bars.mock.lastCall![0]
    expect(props.data).toEqual([
      { month: '2026-01', plan: 0, fact: 10 }, { month: '2026-02', plan: null, fact: null },
      { month: '2026-03', plan: null, fact: -30 }, { month: '2027-01', plan: 60, fact: null },
    ])
    expect(screen.getByText('EBITDA — План')).toBeInTheDocument()
    expect(screen.getByText('EBITDA — Факт')).toBeInTheDocument()
    expect(document.querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect(document.querySelector('.recharts-line')).toBeNull()
    expect(periods[0].period).toBe('2027-01-01')
  })
  it('Cash Flow uses bars for net flow and line for balance, with negatives and nulls preserved', () => {
    render(<CompanyCashFlowChart months={months} />)
    expect(charts.composed.mock.lastCall![0].data).toEqual([
      { month: '2026-01', first: 0, second: 200 }, { month: '2026-02', first: null, second: null }, { month: '2026-03', first: -90, second: -20 },
    ])
    expect(document.querySelectorAll('.recharts-bar')).toHaveLength(1)
    expect(document.querySelectorAll('.recharts-line')).toHaveLength(1)
    expect(screen.getByText('Чистый денежный поток')).toBeInTheDocument()
    expect(screen.getByText('Остаток денежных средств')).toBeInTheDocument()
    expect(screen.queryByText(/План|Факт/)).not.toBeInTheDocument()
  })
  it('does not render fake zero charts for missing series', () => {
    const view = render(<PnLEbitdaChart periods={[{ period: '2026-01-01', plan: scenario(null), fact: null }]} />)
    expect(document.querySelector('svg')).toBeNull()
    view.rerender(<CompanyCashFlowChart months={[]} />)
    expect(document.querySelector('svg')).toBeNull()
    expect(charts.bars).not.toHaveBeenCalled()
    expect(charts.composed).not.toHaveBeenCalled()
  })
})
