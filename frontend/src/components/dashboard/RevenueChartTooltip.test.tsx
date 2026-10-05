import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RevenueChartTooltip } from './RevenueChartTooltip'

describe('RevenueChartTooltip', () => {
  it('preserves zero Fact and the existing delta when both values are available', () => {
    render(<RevenueChartTooltip active label="2026-09" payload={[
      { dataKey: 'fact', name: 'Факт', value: 0 },
      { dataKey: 'plan', name: 'План', value: 100 },
    ]} />)
    expect(screen.getByText('₽0')).toBeInTheDocument()
    expect(screen.getByText('₽100')).toBeInTheDocument()
    expect(screen.getByText('-100 ₽')).toBeInTheDocument()
  })

  it('does not invent a Fact or delta for a Plan-only month', () => {
    render(<RevenueChartTooltip active label="2026-10" payload={[
      { dataKey: 'plan', name: 'План', value: 1200 },
    ]} />)
    expect(screen.getByText('План')).toBeInTheDocument()
    expect(screen.queryByText('Факт')).not.toBeInTheDocument()
    expect(screen.queryByText('Δ')).not.toBeInTheDocument()
    expect(screen.queryByText('₽0')).not.toBeInTheDocument()
  })

  it('shows a missing value as absent and does not compute a delta', () => {
    render(<RevenueChartTooltip active payload={[
      { dataKey: 'fact', name: 'Факт' },
      { dataKey: 'plan', name: 'План', value: 1200 },
    ]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Δ')).not.toBeInTheDocument()
    expect(screen.queryByText('₽0')).not.toBeInTheDocument()
  })

  it('stays hidden when inactive or there are no revenue entries', () => {
    const { container, rerender } = render(<RevenueChartTooltip active={false} payload={[
      { dataKey: 'fact', name: 'Факт', value: 1200 },
    ]} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<RevenueChartTooltip active payload={[{ dataKey: 'other', value: 1200 }]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
