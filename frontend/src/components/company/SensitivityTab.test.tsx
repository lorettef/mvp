import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { SensitivityTab } from './SensitivityTab'
import type { SensitivityResponse } from '@/types/api'

function makeSensitivity(
  over: Partial<SensitivityResponse> = {},
): SensitivityResponse {
  return {
    companyId: 'c1',
    geography: 'RU',
    keyRate: 21,
    discountRate: 31,
    base: {
      equityValue: 1000000,
      terminalValue: 500000,
      fcf: 107040,
      growthRate: 8.5,
      mrr: 200000,
      cac: 1000,
      ltv: 5000,
      churn: 0.035,
      ltvCac: 5.0,
    },
    conservative: {
      equityValue: 800000,
      terminalValue: 400000,
      fcf: 86040,
      growthRate: 7.8,
      mrr: 180000,
      cac: 1100,
      ltv: 4750,
      churn: 0.0385,
      ltvCac: 4.32,
    },
    equityDelta: -200000,
    equityDeltaPct: -20.0,
    summary: 'Консервативный сценарий снижает оценку.',
    ...over,
  }
}

describe('SensitivityTab', () => {
  it('renders header and delta stats', () => {
    render(<SensitivityTab data={makeSensitivity()} />)
    expect(
      screen.getByText('Анализ чувствительности — консервативный сценарий'),
    ).toBeInTheDocument()
    expect(screen.getByText('Δ Equity Value')).toBeInTheDocument()
    expect(screen.getByText('Δ (относительно)')).toBeInTheDocument()
  })

  it('renders comparison table', () => {
    render(<SensitivityTab data={makeSensitivity()} />)
    expect(screen.getByText('Сравнение сценариев')).toBeInTheDocument()
    expect(screen.getByText('Базовый')).toBeInTheDocument()
    expect(screen.getByText('Консервативный')).toBeInTheDocument()
    expect(screen.getByText('LTV/CAC')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<SensitivityTab data={undefined} />)
    expect(
      screen.getByText(/чувствительности ещё не рассчитаны/),
    ).toBeInTheDocument()
  })
})
