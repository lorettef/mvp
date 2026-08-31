import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { UnitEconomicsTab } from './UnitEconomicsTab'
import type { UnitEconomicsResponse } from '@/types/api'

function makeData(over: Partial<UnitEconomicsResponse> = {}): UnitEconomicsResponse {
  return {
    companyId: 'comp1',
    revenue: 120000,
    cac: 1000,
    ltv: 5000,
    churn: 0.03,
    ltvCac: 5.0,
    runwayMonths: 15.0,
    paybackPeriod: 12.0,
    romi: 4.0,
    cash: 300000,
    monthlyBurn: 20000,
    magicNumber: 3.5,
    revenueGrowth: 20000,
    marketingSpend: 4000,
    retention: { m1: 0.8, m3: 0.6, m6: 0.5, m12: 0.4 },
    alerts: ['✅ LTV/CAC = 5.00 — отличный показатель.'],
    ...over,
  }
}

describe('UnitEconomicsTab', () => {
  it('renders LTV/CAC, Magic Number, Runway values', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText('LTV/CAC')).toBeInTheDocument()
    expect(screen.getByText('5.00')).toBeInTheDocument() // ltv_cac
    expect(screen.getByText('Magic Number')).toBeInTheDocument()
    expect(screen.getByText('3.50')).toBeInTheDocument() // magic_number
    expect(screen.getByText('Runway')).toBeInTheDocument()
    expect(screen.getByText('15.0 мес.')).toBeInTheDocument()
  })

  it('renders retention M1/M3/M6/M12', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText('M1')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('40.0%')).toBeInTheDocument()
  })

  it('renders Payback and ROMI cards', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText('Payback')).toBeInTheDocument()
    expect(screen.getByText('12.0 мес.')).toBeInTheDocument()
    expect(screen.getByText('ROMI')).toBeInTheDocument()
    expect(screen.getByText('400.0%')).toBeInTheDocument()
  })

  it('renders alerts', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText(/LTV\/CAC = 5\.00/)).toBeInTheDocument()
  })

  it('shows — for missing values (no NaN/Infinity)', () => {
    render(
      <UnitEconomicsTab
        data={makeData({ ltvCac: null, runwayMonths: null, magicNumber: null })}
      />
    )
    expect(screen.getAllByText('—').length).toBe(3)
    expect(document.body.textContent).not.toContain('NaN')
    expect(document.body.textContent).not.toContain('Infinity')
  })

  it('shows skeleton when loading', () => {
    render(<UnitEconomicsTab data={makeData()} isLoading />)
    expect(screen.queryByText('Юнит-экономика')).not.toBeInTheDocument()
  })
})
