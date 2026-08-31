import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CohortsTab } from './CohortsTab'
import type { Cohort } from '@/types/api'

function makeCohort(over: Partial<Cohort> = {}): Cohort {
  return {
    id: 'c1',
    companyId: 'comp1',
    period: '2025-03-01',
    type: 'plan',
    size: 45,
    retentionM1: 0.95,
    retentionM2: 0.84,
    retentionM3: 0.73,
    retentionM4: 0.62,
    retentionM5: 0.51,
    retentionM6: 0.47,
    retentionM7: 0.36,
    retentionM8: 0.28,
    retentionM9: 0.19,
    retentionM10: 0.11,
    retentionM11: 0.06,
    retentionM12: 0.02,
    marketingSpend: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

describe('CohortsTab', () => {
  it('sorts periods desc and renders plan M1 as %', () => {
    const cohorts = [
      makeCohort({ id: 'a', period: '2025-02-01', retentionM1: 0.5 }),
      makeCohort({ id: 'b', period: '2025-03-01', retentionM1: 0.8 }),
    ]
    render(<CohortsTab cohorts={cohorts} canEdit onSubmit={vi.fn()} isPending={false} />)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('2025-03')
    expect(rows[2]).toHaveTextContent('2025-02')
    expect(screen.getByText('80.0%')).toBeInTheDocument()
  })

  it('shows plan and fact side by side for the same period', () => {
    const cohorts = [
      makeCohort({ id: 'p', type: 'plan', retentionM1: 0.8 }),
      makeCohort({ id: 'f', type: 'fact', retentionM1: 0.7 }),
    ]
    render(<CohortsTab cohorts={cohorts} canEdit onSubmit={vi.fn()} isPending={false} />)
    expect(screen.getByText('80.0%')).toBeInTheDocument()
    expect(screen.getByText('70.0%')).toBeInTheDocument()
    expect(screen.getByText('План')).toBeInTheDocument()
    expect(screen.getByText('Факт')).toBeInTheDocument()
  })

  it('renders 12 month columns', () => {
    render(
      <CohortsTab
        cohorts={[makeCohort()]}
        canEdit
        onSubmit={vi.fn()}
        isPending={false}
      />
    )
    for (let m = 1; m <= 12; m++) {
      expect(screen.getByRole('columnheader', { name: `M${m}` })).toBeInTheDocument()
    }
  })

  it('applies heatmap color classes by retention threshold', () => {
    const cohorts = [
      makeCohort({ retentionM1: 0.8, retentionM2: 0.6, retentionM3: 0.4 }),
    ]
    render(<CohortsTab cohorts={cohorts} canEdit onSubmit={vi.fn()} isPending={false} />)
    expect(screen.getByText('80.0%')).toHaveClass('bg-emerald-500/20')
    expect(screen.getByText('60.0%')).toHaveClass('bg-amber-500/20')
    expect(screen.getByText('40.0%')).toHaveClass('bg-red-500/20')
  })

  it('computes active users and CAC per row', () => {
    const cohorts = [
      makeCohort({ size: 45, retentionM12: 0.25, marketingSpend: 14400 }),
    ]
    render(<CohortsTab cohorts={cohorts} canEdit onSubmit={vi.fn()} isPending={false} />)
    // active = round(45 * 0.25) = 11 ; CAC = 14400 / 45 = 320
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('₽320')).toBeInTheDocument()
  })

  it('submits % → fraction with snake_case keys', () => {
    const onSubmit = vi.fn()
    render(<CohortsTab cohorts={[]} canEdit onSubmit={onSubmit} isPending={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Добавить когорту/ }))
    fireEvent.change(screen.getByLabelText('Период'), { target: { value: '2025-01' } })
    fireEvent.change(screen.getByLabelText('Размер когорты'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('Маркетинг (₽)'), { target: { value: '14400' } })
    fireEvent.change(screen.getByLabelText('M1 (%)'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('M2 (%)'), { target: { value: '70' } })
    fireEvent.change(screen.getByLabelText('M3 (%)'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('M4 (%)'), { target: { value: '55' } })
    fireEvent.change(screen.getByLabelText('M5 (%)'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('M6 (%)'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText('M7 (%)'), { target: { value: '40' } })
    fireEvent.change(screen.getByLabelText('M8 (%)'), { target: { value: '35' } })
    fireEvent.change(screen.getByLabelText('M9 (%)'), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText('M10 (%)'), { target: { value: '25' } })
    fireEvent.change(screen.getByLabelText('M11 (%)'), { target: { value: '20' } })
    fireEvent.change(screen.getByLabelText('M12 (%)'), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSubmit).toHaveBeenCalledWith({
      period: '2025-01-01',
      type: 'plan',
      size: 45,
      retention_m1: 0.8,
      retention_m2: 0.7,
      retention_m3: 0.6,
      retention_m4: 0.55,
      retention_m5: 0.5,
      retention_m6: 0.45,
      retention_m7: 0.4,
      retention_m8: 0.35,
      retention_m9: 0.3,
      retention_m10: 0.25,
      retention_m11: 0.2,
      retention_m12: 0.15,
      marketing_spend: 14400,
    })
  })

  it('shows empty state when there are no cohorts', () => {
    render(<CohortsTab cohorts={[]} canEdit onSubmit={vi.fn()} isPending={false} />)
    expect(screen.getByText('Когорты ещё не добавлены.')).toBeInTheDocument()
  })

  it('hides add button when canEdit is false', () => {
    render(<CohortsTab cohorts={[]} canEdit={false} onSubmit={vi.fn()} isPending={false} />)
    expect(screen.queryByRole('button', { name: /Добавить когорту/ })).not.toBeInTheDocument()
  })
})
