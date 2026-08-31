import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PnLTab } from './PnLTab'
import type { PnLResponse } from '@/types/api'

function makePnl(over: Partial<PnLResponse> = {}): PnLResponse {
  return {
    companyId: 'c1',
    period: '2026-02-01',
    mrr: 100000,
    oneTimeRevenue: 0,
    revenue: 100000,
    fot: 30000,
    socialPayments: 12960,
    marketing: 10000,
    development: 20000,
    gna: 5000,
    totalOpex: 77960,
    ebitda: 22040,
    financialExpenses: 15000,
    netProfit: 7040,
    ebitdaMargin: 0.2204,
    netMargin: 0.0704,
    summary: 'EBITDA = 22 040 ₽ (маржа 22.0%). Чистая прибыль = 7 040 ₽.',
    ...over,
  }
}

describe('PnLTab', () => {
  it('renders revenue, opex, ebitda and net profit', () => {
    render(<PnLTab data={makePnl()} />)
    expect(screen.getByText('P&L — Отчёт о прибылях и убытках')).toBeInTheDocument()
    expect(screen.getByText('EBITDA')).toBeInTheDocument()
    expect(screen.getByText('Чистая прибыль')).toBeInTheDocument()
    expect(screen.getByText('2026-02')).toBeInTheDocument()
  })

  it('labels recurring revenue row as Выручка (not MRR)', () => {
    render(<PnLTab data={makePnl()} />)
    expect(screen.queryByText('MRR')).not.toBeInTheDocument()
    expect(screen.getAllByText('Выручка').length).toBeGreaterThanOrEqual(1)
  })

  it('renders margins', () => {
    render(<PnLTab data={makePnl()} />)
    expect(screen.getByText('22.0%')).toBeInTheDocument()
    expect(screen.getByText('7.0%')).toBeInTheDocument()
  })

  it('marks negative net profit as destructive', () => {
    render(<PnLTab data={makePnl({ netProfit: -5000, netMargin: -0.05 })} />)
    const row = screen.getByText('Чистая прибыль')
    expect(row).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<PnLTab data={undefined} />)
    expect(screen.getByText(/P&L ещё не рассчитаны/)).toBeInTheDocument()
  })
})
