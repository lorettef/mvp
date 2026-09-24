import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MetricCard } from './metric-card'

describe('MetricCard help', () => {
  it('shows an explanation on mouse hover and keeps the metric value unchanged', async () => {
    render(<MetricCard label="LTV (₽)" value="5 000 ₽" description="Estimated customer value." />)
    const label = screen.getByRole('button', { name: 'LTV (₽)' })

    fireEvent.pointerEnter(label, { pointerType: 'mouse' })
    expect(await screen.findByText('Estimated customer value.')).toBeVisible()
    fireEvent.click(label, { detail: 1 })
    expect(screen.getByText('Estimated customer value.')).toBeVisible()
    expect(screen.getByText('5 000 ₽')).toBeInTheDocument()

    fireEvent.pointerLeave(label, { pointerType: 'mouse' })
    await waitFor(() => expect(screen.queryByText('Estimated customer value.')).not.toBeInTheDocument())
    expect(screen.getByText('5 000 ₽')).toBeInTheDocument()
  })

  it('opens by tap and closes on a second tap', async () => {
    render(<MetricCard label="CAC (₽)" value="1 000 ₽" description="Cost per new customer." />)
    const label = screen.getByRole('button', { name: 'CAC (₽)' })

    fireEvent.pointerEnter(label, { pointerType: 'touch' })
    fireEvent.click(label)
    expect(await screen.findByText('Cost per new customer.')).toBeVisible()
    fireEvent.click(label)
    await waitFor(() => expect(screen.queryByText('Cost per new customer.')).not.toBeInTheDocument())
    expect(screen.getByText('1 000 ₽')).toBeInTheDocument()
  })
})
