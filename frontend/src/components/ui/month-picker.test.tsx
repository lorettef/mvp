import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MonthPicker } from './month-picker'

describe('MonthPicker', () => {
  it('emits a YYYY-MM value when a month is selected', () => {
    const onChange = vi.fn()

    render(<MonthPicker value="2025-01" onChange={onChange} aria-label="Период" />)
    fireEvent.click(screen.getByRole('button', { name: /Период/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Март 2025' }))

    expect(onChange).toHaveBeenCalledWith('2025-03')
  })

  it('clears the selected value', () => {
    const onChange = vi.fn()

    render(<MonthPicker value="2025-01" onChange={onChange} aria-label="Период" />)
    fireEvent.click(screen.getByRole('button', { name: /Период/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Очистить месяц' }))

    expect(onChange).toHaveBeenCalledWith('')
  })
})
