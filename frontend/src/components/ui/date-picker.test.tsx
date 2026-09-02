import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DatePicker } from './date-picker'

describe('DatePicker', () => {
  it('emits a YYYY-MM-DD value when a date is selected', () => {
    const onChange = vi.fn()

    render(<DatePicker value="2026-02-10" onChange={onChange} aria-label="Срок" />)
    fireEvent.click(screen.getByRole('button', { name: /Срок/ }))
    fireEvent.click(screen.getByRole('button', { name: /15 февраля 2026/ }))

    expect(onChange).toHaveBeenCalledWith('2026-02-15')
  })

  it('clears the selected value', () => {
    const onChange = vi.fn()

    render(<DatePicker value="2026-02-10" onChange={onChange} aria-label="Срок" />)
    fireEvent.click(screen.getByRole('button', { name: /Срок/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Очистить дату' }))

    expect(onChange).toHaveBeenCalledWith('')
  })
})
