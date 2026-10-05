import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { IndustryProfitabilityItem } from '@/types/api'
import { IndustryProfitabilityChart, IndustryProfitabilityTooltip } from './IndustryProfitabilityChart'

const chartSpy = vi.hoisted(() => vi.fn())
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement, createElement } = await import('react')
  return { ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 300 }),
    BarChart: (props: ComponentProps<typeof actual.BarChart>) => {
      chartSpy(props)
      return createElement(actual.BarChart, props)
    },
  }
})

const item: IndustryProfitabilityItem = { industry: 'fintech', revenue: 13000000,
  totalOpex: 10608000, ebitda: 2392000, ebitdaMargin: 0.184, companiesTotal: 4, companiesIncluded: 3 }
const labels = (slug: string) => ({ fintech: 'Fintech', marketplace: 'Маркетплейсы', construction: 'Строительство и недвижимость' }[slug] ?? slug)
const title = 'Прибыльность по сферам деятельности'
const cells = (name = 'Fintech') => within(screen.getByRole('row', { name: new RegExp(`^${name} `) })).getAllByRole('cell')
beforeEach(() => chartSpy.mockClear())

describe('IndustryProfitabilityChart', () => {
  it.each([[0.184, '18.4%'], [-0.075, '−7.5%'], [0, '0.0%']] as const)('preserves margin %s with signed percent text', (margin, display) => {
    render(<IndustryProfitabilityChart data={[{ ...item, ebitdaMargin: margin }]} industryLabel={labels} />)
    expect(cells()[0]).toHaveTextContent(display)
    expect(chartSpy.mock.calls[0][0].data[0].ebitdaMargin).toBe(margin)
    expect(chartSpy.mock.calls[0][0].layout).toBe('vertical')
    expect(screen.queryByText('Недостаточно фактических данных для расчёта прибыльности.')).not.toBeInTheDocument()
  })

  it('renders a zero reference line and catalog labels without deriving financial values', () => {
    const data = [item, { ...item, industry: 'marketplace', ebitdaMargin: -0.1 }]
    const { container } = render(<IndustryProfitabilityChart data={data} industryLabel={labels} />)
    expect(container.querySelector('.recharts-reference-line')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Маркетплейсы' })).toBeInTheDocument()
    expect(chartSpy.mock.calls[0][0].data[0]).toEqual({ ...item, label: 'Fintech' })
    expect(chartSpy.mock.calls[0][0].data.map((p: IndustryProfitabilityItem) => p.industry)).toEqual(['fintech', 'marketplace'])
  })

  it('keeps a null margin as missing next to a valid margin', () => {
    render(<IndustryProfitabilityChart data={[item, { ...item, industry: 'marketplace', ebitdaMargin: null, companiesIncluded: 0 }]} industryLabel={labels} />)
    expect(chartSpy.mock.calls[0][0].data[1].ebitdaMargin).toBeNull()
    expect(cells('Маркетплейсы')[0]).toHaveTextContent('—')
    expect(cells('Маркетплейсы')[4]).toHaveTextContent('Учтены 0 из 4 компаний')
  })

  it('explains undefined margin for real zero revenue without a fake zero bar', () => {
    render(<IndustryProfitabilityChart data={[{ ...item, revenue: 0, ebitda: -100000, totalOpex: 100000, ebitdaMargin: null, companiesIncluded: 4 }]} industryLabel={labels} />)
    expect(chartSpy).not.toHaveBeenCalled()
    expect(cells()[0]).toHaveTextContent('—')
    expect(cells()[1]).toHaveTextContent('₽-100 000')
    expect(cells()[2]).toHaveTextContent('₽0')
    expect(screen.getByText(/Маржа не определена при нулевой выручке/)).toBeInTheDocument()
  })

  it('distinguishes null industry from real other and unknown slugs', () => {
    const errors = vi.spyOn(console, 'error')
    render(<IndustryProfitabilityChart data={[{ ...item, industry: null }, { ...item, industry: 'other' }, { ...item, industry: 'unspecified' }]} industryLabel={labels} />)
    expect(screen.getByRole('rowheader', { name: 'Не указана' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'other' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'unspecified' })).toBeInTheDocument()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
  })

  it('retains readable full long industry labels in the accessible summary', () => {
    render(<IndustryProfitabilityChart data={[{ ...item, industry: 'construction' }]} industryLabel={labels} />)
    expect(screen.getByRole('rowheader', { name: 'Строительство и недвижимость' })).toBeInTheDocument()
  })

  it('formats backend money and percentages consistently in tooltip with coverage information', () => {
    render(<IndustryProfitabilityTooltip active payload={[{ payload: { ...item, label: 'Fintech' } }]} />)
    expect(screen.getByText('Fintech')).toBeInTheDocument()
    for (const value of ['18.4%', '₽2 392 000', '₽13 000 000', '₽10 608 000']) expect(screen.getByText(value)).toBeInTheDocument()
    expect(screen.getByText('Учтены 3 из 4 компаний')).toBeInTheDocument()
    expect(screen.getByText(/Расчёт основан только на компаниях с полными Fact-данными/)).toBeInTheDocument()
    expect(screen.queryByText(/Чистая прибыль/)).not.toBeInTheDocument()
  })

  it('does not warn about incomplete data when all companies are included', () => {
    render(<IndustryProfitabilityTooltip active payload={[{ payload: { ...item, label: 'Fintech', companiesIncluded: 4 } }]} />)
    expect(screen.getByText('Учтены 4 из 4 компаний')).toBeInTheDocument()
    expect(screen.queryByText(/Расчёт основан только/)).not.toBeInTheDocument()
  })

  it.each([{ data: [] }, { data: [{ ...item, ebitdaMargin: null }] }])('explains empty/all-null data without rendering a chart', ({ data }) => {
    render(<IndustryProfitabilityChart data={data} industryLabel={labels} />)
    expect(screen.getByText('Недостаточно фактических данных для расчёта прибыльности.')).toBeInTheDocument()
    expect(chartSpy).not.toHaveBeenCalled()
  })

  it('updates from the global filtered response and retains backend ordering', () => {
    const { rerender } = render(<IndustryProfitabilityChart data={[item, { ...item, industry: 'marketplace' }]} industryLabel={labels} />)
    rerender(<IndustryProfitabilityChart data={[{ ...item, ebitdaMargin: 0.11, companiesIncluded: 1, companiesTotal: 1 }]} industryLabel={labels} />)
    expect(chartSpy.mock.calls[chartSpy.mock.calls.length - 1][0].data).toHaveLength(1)
    expect(screen.queryByRole('rowheader', { name: 'Маркетплейсы' })).not.toBeInTheDocument()
    expect(cells()[0]).toHaveTextContent('11.0%')
  })

  it('provides industry, margin, EBITDA and included count in accessible text', () => {
    render(<IndustryProfitabilityChart data={[item]} industryLabel={labels} />)
    expect(screen.getByRole('region', { name: title })).toHaveAccessibleDescription(/Маржа отрасли равна сумме EBITDA/)
    const table = screen.getByRole('table', { name: title })
    expect(table).toHaveTextContent('Fintech18.4%₽2 392 000₽13 000 000₽10 608 000Учтены 3 из 4 компаний')
  })

  it('delegates reset to the existing E5 handler', () => {
    const reset = vi.fn()
    render(<IndustryProfitabilityChart data={[]} industryLabel={labels} onResetFilters={reset} />)
    fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }))
    expect(reset).toHaveBeenCalledOnce()
  })
})
