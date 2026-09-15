import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { HiringTab } from './HiringTab'
import type {
  HiringMonthRow,
  HiringPlanResponse,
  HiringRolePlan,
  HiringSettingsResponse,
} from '@/types/api'

function makeRole(over: Partial<HiringRolePlan> = {}): HiringRolePlan {
  return {
    roleKey: 'backend',
    label: 'Backend',
    group: 'engineering',
    requiredHeadcount: 2,
    recommendedHires: 1,
    approvedHires: 0,
    salary: 150000,
    employerCost: 45300,
    ...over,
  }
}

function makeMonth(over: Partial<HiringMonthRow> = {}): HiringMonthRow {
  return {
    period: '2026-10-01',
    roles: [
      makeRole(),
      makeRole({
        roleKey: 'sales_manager',
        label: 'Sales Manager',
        group: 'sales',
        requiredHeadcount: 5,
        recommendedHires: 5,
      }),
    ],
    totalRequired: 7,
    totalApproved: 0,
    payroll: 500000,
    hiresPayroll: 0,
    ...over,
  }
}

function makePlan(over: Partial<HiringPlanResponse> = {}): HiringPlanResponse {
  return {
    companyId: 'c1',
    forecastStart: '2026-10-01',
    settings: {
      companyId: 'c1',
      ndflRate: 0.13,
      insuranceRate: 0.3,
      injuryRate: 0.002,
      totalRate: 0.432,
      employerRate: 0.302,
    },
    team: [{ roleKey: 'backend', headcount: 1, salary: 150000 }],
    months: [makeMonth()],
    finalHeadcount: 7,
    summary: 'Целевой штат через 12 мес.',
    ...over,
  }
}

describe('HiringTab', () => {
  it('renders role plan and forecast start', () => {
    render(<HiringTab data={makePlan()} canEdit={false} />)
    expect(screen.getByText('Backend')).toBeInTheDocument()
    expect(screen.getByText('Sales Manager')).toBeInTheDocument()
    expect(screen.getAllByText('2026-10').length).toBeGreaterThan(0)
    expect(screen.getByText('7 чел.')).toBeInTheDocument()
  })

  it('shows required/recommended/approved columns', () => {
    render(<HiringTab data={makePlan()} canEdit={false} />)
    expect(screen.getAllByText('Требуется').length).toBeGreaterThan(0)
    expect(screen.getByText('Рекомендовано')).toBeInTheDocument()
    expect(screen.getAllByText('Одобрено').length).toBeGreaterThan(0)
  })

  it('shows empty hint when no metrics', () => {
    render(
      <HiringTab data={makePlan({ months: [], finalHeadcount: 0 })} canEdit={false} />,
    )
    expect(screen.getByText(/Добавьте метрики выручки/)).toBeInTheDocument()
  })

  it('shows social payment field labels', () => {
    render(<HiringTab data={makePlan()} canEdit />)
    expect(screen.getByText('НДФЛ (%)')).toBeInTheDocument()
    expect(screen.getByText('Страховые взносы (%)')).toBeInTheDocument()
    expect(screen.getByText('Травматизм (%)')).toBeInTheDocument()
  })

  it('saves social payment settings as fractions', () => {
    const onSave = vi.fn()
    render(<HiringTab data={makePlan()} canEdit onSaveSettings={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить настройки' }))
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
            employerRate: 0.26,
          } as HiringSettingsResponse,
        })}
        canEdit
      />,
    )

    expect(screen.getByLabelText('НДФЛ (%)')).toHaveValue(15)
    expect(screen.getByLabelText('Страховые взносы (%)')).toHaveValue(25)
    expect(screen.getByLabelText('Травматизм (%)')).toHaveValue(1)
  })
})
