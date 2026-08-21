import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ValuationTab } from './ValuationTab'
import type { ValuationResponse } from '@/types/api'

function makeValuation(over: Partial<ValuationResponse> = {}): ValuationResponse {
  return {
    companyId: 'c1',
    geography: 'RU',
    keyRate: 21,
    discountRate: 31,
    growthRate: 8.5,
    fcf: 7040,
    terminalValue: 33948.44,
    debt: 100000,
    cash: 200000,
    netDebt: -100000,
    equityValue: 133948.44,
    revenueAnnual: 1200000,
    psRatio: 0.11,
    headcount: 1,
    valuePerEmployee: 133948.44,
    summary: 'Оценка (Equity Value) = 133 948 ₽.',
    ...over,
  }
}

describe('ValuationTab', () => {
  it('renders valuation stats', () => {
    render(<ValuationTab data={makeValuation()} />)
    expect(screen.getByText('Оценка бизнеса — модель Гордона')).toBeInTheDocument()
    expect(screen.getByText('Equity Value')).toBeInTheDocument()
    expect(screen.getByText('Terminal Value (TV)')).toBeInTheDocument()
    expect(screen.getByText('P/S')).toBeInTheDocument()
    expect(screen.getByText('На сотрудника')).toBeInTheDocument()
  })

  it('renders parameters', () => {
    render(<ValuationTab data={makeValuation()} />)
    expect(screen.getByText('Ставка дисконта (r = КС + 10%)')).toBeInTheDocument()
    expect(screen.getByText('Чистый долг')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<ValuationTab data={undefined} />)
    expect(screen.getByText(/оценки бизнеса ещё не рассчитаны/)).toBeInTheDocument()
  })
})
