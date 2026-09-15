import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FinancingTab } from './FinancingTab'
import type { FinancingResponse } from '@/types/api'

function makeFinancing(over: Partial<FinancingResponse> = {}): FinancingResponse {
  return {
    id: 'f1',
    companyId: 'c1',
    type: 'investment',
    investorType: 'founder',
    counterpartyName: 'Иван',
    amount: 500000,
    currency: 'RUB',
    issuedDate: '2026-01-15',
    annualRate: null,
    termMonths: null,
    repaymentType: null,
    firstPaymentDate: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00',
    updatedAt: '2026-01-01T00:00:00',
    ...over,
  }
}

describe('FinancingTab', () => {
  it('renders investments and loans sections with amounts', () => {
    render(
      <FinancingTab
        data={[
          makeFinancing(),
          makeFinancing({
            id: 'f2',
            type: 'loan',
            investorType: null,
            counterpartyName: 'Банк',
            amount: 100000,
            annualRate: 15,
            termMonths: 12,
          }),
        ]}
      />,
    )
    expect(screen.getByText('Инвестиции')).toBeInTheDocument()
    expect(screen.getByText('Кредиты')).toBeInTheDocument()
    expect(screen.getByText('Иван')).toBeInTheDocument()
    expect(screen.getByText('Банк')).toBeInTheDocument()
    expect(screen.getByText('15% / 12 мес.')).toBeInTheDocument()
  })

  it('shows empty hint when no financing', () => {
    render(<FinancingTab data={[]} />)
    expect(screen.getAllByText(/Финансирование ещё не добавлено/).length).toBeGreaterThan(0)
  })

  it('hides add button when canEdit is false', () => {
    render(<FinancingTab data={[]} canEdit={false} />)
    expect(screen.queryByText('Добавить')).not.toBeInTheDocument()
  })

  it('calls onDelete with the financing id', () => {
    const onDelete = vi.fn()
    render(
      <FinancingTab data={[makeFinancing()]} canEdit onDelete={onDelete} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    expect(onDelete).toHaveBeenCalledWith('f1')
  })

  it('submits an investment via onCreate', () => {
    const onCreate = vi.fn()
    render(<FinancingTab data={[]} canEdit onCreate={onCreate} />)
    fireEvent.click(screen.getByText('Добавить'))
    fireEvent.change(screen.getByLabelText('Сумма'), { target: { value: '300000' } })
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Фонд А' } })
    fireEvent.click(screen.getByText('Сохранить'))
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'investment',
        investor_type: 'founder',
        amount: 300000,
        counterparty_name: 'Фонд А',
      }),
    )
  })
})
