import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HiringTab } from './HiringTab'
import type {
  HiringMonthRow,
  HiringPlanResponse,
  HiringSettingsResponse,
} from '@/types/api'

function makeMonth(over: Partial<HiringMonthRow> = {}): HiringMonthRow {
  return {
    month: 1,
    period: '2026-09-01',
    revenue: 105000,
    fot: 36750,
    socialPayments: 15876,
    totalCost: 52626,
    headcount: 3,
    devCount: 1,
    salesCount: 1,
    marketingCount: 1,
    ...over,
  }
}

function makePlan(over: Partial<HiringPlanResponse> = {}): HiringPlanResponse {
  return {
    companyId: 'c1',
    industry: 'saas',
    industryLabel: 'SaaS',
    baseRevenue: 100000,
    fotShare: 0.35,
    avgSalary: 150000,
    monthlyGrowth: 0.05,
    settings: {
      companyId: 'c1',
      ndflRate: 0.13,
      insuranceRate: 0.3,
      injuryRate: 0.002,
      totalRate: 0.432,
    },
    months: [makeMonth()],
    finalHeadcount: 3,
    summary: 'Целевой штат «SaaS» через 12 мес.',
    ...over,
  }
}

describe('HiringTab', () => {
  it('renders industry, headcount and month period', () => {
    render(<HiringTab data={makePlan()} canEdit={false} />)
    expect(screen.getByText('SaaS')).toBeInTheDocument()
    expect(screen.getByText('3 чел.')).toBeInTheDocument()
    expect(screen.getByText('2026-09')).toBeInTheDocument()
  })

  it('shows staff breakdown for a month row', () => {
    render(<HiringTab data={makePlan()} canEdit={false} />)
    expect(screen.getByText('3 (1/1/1)')).toBeInTheDocument()
  })

  it('shows empty hint when no metrics', () => {
    render(
      <HiringTab
        data={makePlan({ baseRevenue: null, months: [], finalHeadcount: 0 })}
        canEdit={false}
      />,
    )
    expect(
      screen.getByText(/Добавьте метрики выручки/),
    ).toBeInTheDocument()
  })

  it('shows social payment field labels', () => {
    render(<HiringTab data={makePlan()} canEdit />)
    expect(screen.getByText('НДФЛ (%)')).toBeInTheDocument()
    expect(screen.getByText('Страховые взносы (%)')).toBeInTheDocument()
    expect(screen.getByText('Травматизм (%)')).toBeInTheDocument()
  })

  it('saves social payment settings as fractions', () => {
    const onSave = vi.fn()
    render(
      <HiringTab data={makePlan()} canEdit onSaveSettings={onSave} />,
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Сохранить настройки' }),
    )
    expect(onSave).toHaveBeenCalledWith({
      ndfl_rate: 0.13,
      insurance_rate: 0.3,
      injury_rate: 0.002,
    })
  })

  it('hides settings form when canEdit=false', () => {
    render(<HiringTab data={makePlan()} canEdit={false} />)
    expect(
      screen.queryByRole('button', { name: 'Сохранить настройки' }),
    ).not.toBeInTheDocument()
  })

  it('syncs the settings form to the new company when companyId changes', () => {
    const { rerender } = render(<HiringTab data={makePlan()} canEdit />)
    expect(screen.getByLabelText('НДФЛ (%)')).toHaveValue(13)

    rerender(
      <HiringTab
        data={makePlan({
          companyId: 'c2',
          settings: {
            companyId: 'c2',
            ndflRate: 0.15,
            insuranceRate: 0.25,
            injuryRate: 0.01,
            totalRate: 0.41,
          },
        })}
        canEdit
      />,
    )

    expect(screen.getByLabelText('НДФЛ (%)')).toHaveValue(15)
    expect(screen.getByLabelText('Страховые взносы (%)')).toHaveValue(25)
    expect(screen.getByLabelText('Травматизм (%)')).toHaveValue(1)
  })

  it('resets the settings form to defaults when the new company has no settings', () => {
    const onSave = vi.fn()
    const { rerender } = render(
      <HiringTab
        data={makePlan({
          settings: {
            companyId: 'c1',
            ndflRate: 0.15,
            insuranceRate: 0.25,
            injuryRate: 0.01,
            totalRate: 0.41,
          },
        })}
        canEdit
        onSaveSettings={onSave}
      />,
    )
    expect(screen.getByLabelText('НДФЛ (%)')).toHaveValue(15)

    rerender(
      <HiringTab
        data={makePlan({
          companyId: 'c2',
          settings: undefined as unknown as HiringSettingsResponse,
        })}
        canEdit
        onSaveSettings={onSave}
      />,
    )

    expect(screen.getByLabelText('НДФЛ (%)')).toHaveValue(13)
    expect(screen.getByLabelText('Страховые взносы (%)')).toHaveValue(30)
    expect(screen.getByLabelText('Травматизм (%)')).toHaveValue(0.2)

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }))
    expect(onSave).toHaveBeenCalledWith({
      ndfl_rate: 0.13,
      insurance_rate: 0.3,
      injury_rate: 0.002,
    })
  })
})
