import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Forecast } from './Forecast'
import type { ForecastResponse } from '@/types/api'

const mocks = vi.hoisted(() => ({
  forecastApi: {
    predict: vi.fn(),
  },
  analytics: {
    track: vi.fn(),
  },
}))

vi.mock('@/api/forecast', () => ({ forecastApi: mocks.forecastApi }))
vi.mock('@/api/analytics', () => ({ analytics: mocks.analytics }))

const fullResponse: ForecastResponse = {
  predictions: [60000, 62000, 65000],
  confidenceInterval: {
    lower: [58000, 60000, 63000],
    upper: [62000, 64000, 67000],
  },
  method: 'polynomial',
}

describe('Forecast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Recharts ResponsiveContainer uses ResizeObserver, which jsdom does not
    // provide. Report a concrete size so the chart actually renders its DOM.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private callback: ResizeObserverCallback

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback
        }

        observe() {
          this.callback(
            [{ contentRect: { width: 800, height: 320 } }] as unknown as ResizeObserverEntry[],
            this as unknown as ResizeObserver,
          )
        }

        unobserve() {}
        disconnect() {}
      },
    )
  })

  it('renders a placeholder instead of crashing when predictions are empty', async () => {
    mocks.forecastApi.predict.mockResolvedValue({
      predictions: [],
      method: 'linear',
    } satisfies ForecastResponse)

    render(<Forecast />)
    fireEvent.click(screen.getByRole('button', { name: /Построить прогноз/ }))

    expect(await screen.findByText('Результат прогноза')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.getByText(/первый прогнозный/)).toBeInTheDocument()
  })

  it('renders the first-prediction stat in rubles, without a dollar sign', async () => {
    mocks.forecastApi.predict.mockResolvedValue(fullResponse)

    const { container } = render(<Forecast />)
    fireEvent.click(screen.getByRole('button', { name: /Построить прогноз/ }))

    await screen.findByText('Результат прогноза')
    expect(screen.getByText('₽60000')).toBeInTheDocument()
    expect(container.textContent).toContain('₽')
    expect(container.textContent).not.toMatch(/\$/)
  })

  it('renders the confidence band in the legend (ComposedChart keeps the Area children)', async () => {
    mocks.forecastApi.predict.mockResolvedValue(fullResponse)

    render(<Forecast />)
    fireEvent.click(screen.getByRole('button', { name: /Построить прогноз/ }))

    // In a LineChart recharts silently drops <Area> children, so the legend
    // item "Дов. интервал" only appears when the chart is a ComposedChart.
    expect(await screen.findByText('Дов. интервал')).toBeInTheDocument()
  })
})
