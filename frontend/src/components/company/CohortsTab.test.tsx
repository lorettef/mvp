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
    retentionM1: 0.8,
    retentionM3: 0.6,
    retentionM6: 0.5,
    retentionM12: 0.4,
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
  })

  it('submits % → fraction with snake_case keys', () => {
    const onSubmit = vi.fn()
    render(<CohortsTab cohorts={[]} canEdit onSubmit={onSubmit} isPending={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Добавить когорту/ }))
    fireEvent.change(screen.getByLabelText('Период'), { target: { value: '2025-01' } })
    fireEvent.change(screen.getByLabelText('M1 (%)'), { target: { value: '80' } })
    fireEvent.change(screen.getByLabelText('M3 (%)'), { target: { value: '60' } })
    fireEvent.change(screen.getByLabelText('M6 (%)'), { target: { value: '50' } })
    fireEvent.change(screen.getByLabelText('M12 (%)'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSubmit).toHaveBeenCalledWith({
      period: '2025-01-01',
      type: 'plan',
      retention_m1: 0.8,
      retention_m3: 0.6,
      retention_m6: 0.5,
      retention_m12: 0.4,
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
