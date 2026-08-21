import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CreditTab } from './CreditTab'
import type { CreditForecastResponse } from '@/types/api'

function makeCredit(over: Partial<CreditForecastResponse> = {}): CreditForecastResponse {
  return {
    companyId: 'c1',
    geography: 'RU',
    keyRate: 21,
    creditRate: 26,
    openingCash: 100000,
    baseRevenue: 50000,
    baseOpex: 77960,
    months: [
      {
        month: 1,
        period: '2026-09-01',
        revenue: 52500,
        opex: 77960,
        netCf: -25460,
        balanceBefore: 74540,
        balanceAfter: 74540,
      },
    ],
    gaps: [
      {
        month: 1,
        period: '2026-09-01',
        balanceBefore: -100,
        gap: 100,
        creditAmount: 110,
        rate: 26,
      },
    ],
    totalCreditNeeded: 110,
    summary: 'Обнаружено кассовых разрывов: 1.',
    ...over,
  }
}

describe('CreditTab', () => {
  it('renders stats and summary', () => {
    render(<CreditTab data={makeCredit()} />)
    expect(screen.getByText('Кредиты — умное прогнозирование')).toBeInTheDocument()
    expect(screen.getByText('Ключевая ставка')).toBeInTheDocument()
    expect(screen.getByText('21.0%')).toBeInTheDocument()
    expect(screen.getByText('Требуется кредит')).toBeInTheDocument()
  })

  it('renders cash gaps', () => {
    render(<CreditTab data={makeCredit()} />)
    expect(screen.getByText('Кассовые разрывы')).toBeInTheDocument()
    expect(screen.getAllByText('2026-09').length).toBeGreaterThan(0)
  })

  it('renders monthly projection', () => {
    render(<CreditTab data={makeCredit()} />)
    expect(screen.getByText('Прогноз по месяцам')).toBeInTheDocument()
    expect(screen.getByText('Net CF')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(<CreditTab data={undefined} />)
    expect(
      screen.getByText(/прогнозирования кредитов ещё не рассчитаны/),
    ).toBeInTheDocument()
  })
})
