import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { BudgetTab } from './BudgetTab'
import type { Budget } from '@/types/api'

function chooseMonth(label: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Период' }))
  const targetYear = Number(label.slice(-4))
  const currentYear = new Date().getFullYear()
  const direction = targetYear < currentYear ? 'Предыдущий год' : 'Следующий год'
  const steps = Math.abs(targetYear - currentYear)
  for (let step = 0; step < steps; step += 1) {
    fireEvent.click(screen.getByRole('button', { name: direction }))
  }
  fireEvent.click(screen.getByRole('button', { name: label }))
}

function makeBudget(over: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    companyId: 'comp1',
    period: '2025-03-01',
    type: 'plan',
    marketing: 100000,
    development: 200000,
    fot: 300000,
    gna: 50000,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

describe('BudgetTab', () => {
  it('renders positive deviation ₽ and % with emerald color', () => {
    const budgets = [
      makeBudget({ id: 'p', type: 'plan', marketing: 100000, development: 0, fot: 0, gna: 0 }),
      makeBudget({ id: 'f', type: 'fact', marketing: 120000, development: 0, fot: 0, gna: 0 }),
    ]
    render(<BudgetTab budgets={budgets} canEdit onSubmit={vi.fn()} isPending={false} />)
    const pct = screen.getByText('+20.0%')
    expect(pct).toBeInTheDocument()
    expect(pct.parentElement).toHaveClass('text-emerald-500')
    expect(pct.parentElement).toHaveTextContent(/20\s?000/)
  })

  it('renders negative deviation with destructive color', () => {
    const budgets = [
      makeBudget({ id: 'p', type: 'plan', marketing: 120000, development: 0, fot: 0, gna: 0 }),
      makeBudget({ id: 'f', type: 'fact', marketing: 100000, development: 0, fot: 0, gna: 0 }),
    ]
    render(<BudgetTab budgets={budgets} canEdit onSubmit={vi.fn()} isPending={false} />)
    const pct = screen.getByText('-16.7%')
    expect(pct).toBeInTheDocument()
    expect(pct.parentElement).toHaveClass('text-destructive')
  })

  it('guards against division by zero when plan=0', () => {
    const budgets = [
      makeBudget({ id: 'p', type: 'plan', marketing: 0, development: 0, fot: 0, gna: 0 }),
      makeBudget({ id: 'f', type: 'fact', marketing: 50000, development: 0, fot: 0, gna: 0 }),
    ]
    render(<BudgetTab budgets={budgets} canEdit onSubmit={vi.fn()} isPending={false} />)
    // plan=0 → no % for marketing deviation
    expect(screen.queryByText('+50.0%')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('NaN')
    expect(document.body.textContent).not.toContain('Infinity')
  })

  it('submits numeric values without string coercion', () => {
    const onSubmit = vi.fn()
    render(<BudgetTab budgets={[]} canEdit onSubmit={onSubmit} isPending={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Добавить бюджет/ }))
    chooseMonth('Январь 2025')
    fireEvent.change(screen.getByLabelText('Маркетинг (₽)'), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText('Разработка (₽)'), { target: { value: '200000' } })
    fireEvent.change(screen.getByLabelText('ФОТ (₽)'), { target: { value: '300000' } })
    fireEvent.change(screen.getByLabelText('G&A (₽)'), { target: { value: '50000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onSubmit).toHaveBeenCalledWith({
      period: '2025-01-01',
      type: 'plan',
      marketing: 100000,
      development: 200000,
      fot: 300000,
      gna: 50000,
    })
  })

  it('shows empty state and hides add button when canEdit=false', () => {
    const { rerender } = render(
      <BudgetTab budgets={[]} canEdit onSubmit={vi.fn()} isPending={false} />
    )
    expect(screen.getByText('Бюджет ещё не добавлен.')).toBeInTheDocument()
    rerender(
      <BudgetTab budgets={[]} canEdit={false} onSubmit={vi.fn()} isPending={false} />
    )
    expect(
      screen.queryByRole('button', { name: /Добавить бюджет/ })
    ).not.toBeInTheDocument()
  })

  it('confirms budget deletion before invoking the callback', () => {
    const onDelete = vi.fn()
    render(
      <BudgetTab
        budgets={[makeBudget()]}
        canEdit
        onSubmit={vi.fn()}
        onDelete={onDelete}
        isPending={false}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Удалить бюджет' }))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))

    expect(onDelete).toHaveBeenCalledWith('b1')
  })
})
