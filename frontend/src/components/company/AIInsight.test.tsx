import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AIInsight } from './AIInsight'

const mocks = vi.hoisted(() => ({
  insight: vi.fn(),
}))

vi.mock('@/api/companies', () => ({
  companiesApi: { insight: mocks.insight },
}))

describe('AIInsight', () => {
  it('fetches insight on click and shows provider badge', async () => {
    mocks.insight.mockResolvedValue({
      companyId: 'comp1',
      scenario: 'valuation',
      provider: 'demo',
      text: 'Оценка выглядит заниженной.',
    })

    render(<AIInsight companyId="comp1" scenario="valuation" />)

    fireEvent.click(screen.getByRole('button', { name: /AI-анализ модуля/ }))

    await waitFor(() => expect(mocks.insight).toHaveBeenCalledWith('comp1', 'valuation'))
    expect(await screen.findByText('Оценка выглядит заниженной.')).toBeInTheDocument()
    expect(screen.getByText('демо-режим')).toBeInTheDocument()
  })
})
