import { render, screen } from '@testing-library/react'
import type { ComponentProps, ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PerformancePoint } from '@/types/api'
import { PortfolioRevenueChart } from './PortfolioRevenueChart'

const chartDataSpy = vi.hoisted(() => vi.fn())

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement, createElement } = await import('react')
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 256 }),
    BarChart: (props: ComponentProps<typeof actual.BarChart>) => {
      chartDataSpy(props.data)
      return createElement(actual.BarChart, props)
    },
  }
})

describe('PortfolioRevenueChart', () => {
  beforeEach(() => chartDataSpy.mockClear())

  const points: PerformancePoint[] = [
    { month: '2026-08', fact: 1200, plan: 1400 },
    { month: '2026-09', fact: 0, plan: null },
    { month: '2026-10', fact: null, plan: 1800 },
    { month: '2026-11', fact: null, plan: null },
  ]

  it('renders two bar series with the Fact/Plan legend, without lines', () => {
    const { container } = render(<PortfolioRevenueChart data={points} />)
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(2)
    expect([...container.querySelectorAll('.recharts-legend-item')].map((item) => item.textContent)).toEqual(['Факт', 'План'])
    expect(container.querySelector('.recharts-line')).not.toBeInTheDocument()
  })

  it.each(['fact', 'plan'] as const)('renders only the selected %s series', (series) => {
    const { container } = render(<PortfolioRevenueChart data={points} series={[series]} />)
    expect(container.querySelectorAll('.recharts-bar')).toHaveLength(1)
    expect(container.querySelector('.recharts-legend-item')).toHaveTextContent(series === 'fact' ? 'Факт' : 'План')
  })

  it('passes periods, null and zero to Recharts unchanged, including incomplete months', () => {
    const snapshot = structuredClone(points)
    render(<PortfolioRevenueChart data={points} />)
    expect(chartDataSpy).toHaveBeenCalledWith(points)
    const passedData = chartDataSpy.mock.calls[chartDataSpy.mock.calls.length - 1][0] as PerformancePoint[]
    expect(passedData).toBe(points)
    expect(points).toEqual(snapshot)
    expect(passedData[1]).toEqual({ month: '2026-09', fact: 0, plan: null })
    expect(passedData[3]).toEqual({ month: '2026-11', fact: null, plan: null })
  })

  it.each(['fact', 'plan'] as const)('treats real zero %s as data', (series) => {
    const data = [{ month: '2026-09', fact: series === 'fact' ? 0 : null, plan: series === 'plan' ? 0 : null }]
    render(<PortfolioRevenueChart data={data} series={[series]} />)
    expect(screen.getByRole('region', { name: 'Выручка портфеля по месяцам' })).toBeInTheDocument()
    expect(chartDataSpy).toHaveBeenCalledWith(data)
    expect(screen.queryByText('Нет данных для выбранного режима.')).not.toBeInTheDocument()
  })

  it('explains an empty dataset', () => {
    render(<PortfolioRevenueChart data={[]} />)
    expect(screen.getByText('Добавьте метрики, чтобы увидеть динамику выручки.')).toBeInTheDocument()
    expect(chartDataSpy).not.toHaveBeenCalled()
  })

  it.each(['fact', 'plan'] as const)('explains missing %s without inventing zero', (series) => {
    render(<PortfolioRevenueChart data={[{ month: '2026-09', fact: series === 'fact' ? null : 1200, plan: series === 'plan' ? null : 1400 }]} series={[series]} />)
    expect(screen.getByText('Нет данных для выбранного режима.')).toBeInTheDocument()
    expect(chartDataSpy).not.toHaveBeenCalled()
  })

  it('does not render a fictitious chart when all values are missing', () => {
    render(<PortfolioRevenueChart data={[{ month: '2026-09', fact: null, plan: null }]} />)
    expect(screen.getByText('Нет данных для выбранного режима.')).toBeInTheDocument()
    expect(chartDataSpy).not.toHaveBeenCalled()
  })
})
