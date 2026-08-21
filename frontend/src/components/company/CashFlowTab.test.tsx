import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CashFlowTab } from './CashFlowTab'
import type { CashFlowResponse } from '@/types/api'

function makeCashFlow(over: Partial<CashFlowResponse> = {}): CashFlowResponse {
  return {
    companyId: 'c1',
    period: '2026-02-01',
    netProfit: 7040,
    amortization: 0,
    operatingCf: 7040,
    capex: 0,
    investingCf: 0,
    investments: 200000,
    credits: 100000,
    financingCf: 300000,
    totalCf: 307040,
    openingBalance: 0,
    closingBalance: 307040,
    summary: 'Операционный CF = 7 040 ₽, финансовый CF = 300 000 ₽.',
    ...over,
  }
}

describe('CashFlowTab', () => {
  it('renders all three CF sections and closing balance', () => {
    render(<CashFlowTab data={makeCashFlow()} />)
    expect(
      screen.getByText('Cash Flow — Движение денежных средств'),
    ).toBeInTheDocument()
    expect(screen.getByText('Операционный CF')).toBeInTheDocument()
    expect(screen.getByText('Инвестиционный CF')).toBeInTheDocument()
    expect(screen.getByText('Финансовый CF')).toBeInTheDocument()
    expect(screen.getByText('Остаток на конец месяца')).toBeInTheDocument()
    expect(screen.getByText('2026-02')).toBeInTheDocument()
  })

  it('renders financing amounts', () => {
    render(<CashFlowTab data={makeCashFlow()} />)
    expect(screen.getByText('Инвестиции')).toBeInTheDocument()
    expect(screen.getByText('Кредиты')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<CashFlowTab data={undefined} />)
    expect(screen.getByText(/Cash Flow ещё не рассчитаны/)).toBeInTheDocument()
  })
})
