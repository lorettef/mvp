import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AIInsight } from './AIInsight'

const mocks = vi.hoisted(() => ({
  insight: vi.fn(),
}))

vi.mock('@/api/companies', () => ({
  companiesApi: { insight: mocks.insight },
}))

const insightPayload = {
  companyId: 'comp1',
  scenario: 'valuation',
  provider: 'demo',
  text: 'Оценка выглядит заниженной.',
}

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('AIInsight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.insight.mockResolvedValue(insightPayload)
  })

  it('fetches insight on click and shows provider badge', async () => {
    render(<AIInsight companyId="comp1" scenario="valuation" />)

    fireEvent.click(screen.getByRole('button', { name: /AI-анализ модуля/ }))

    await waitFor(() => expect(mocks.insight).toHaveBeenCalledWith('comp1', 'valuation'))
    expect(await screen.findByText('Оценка выглядит заниженной.')).toBeInTheDocument()
    expect(screen.getByText('демо-режим')).toBeInTheDocument()
  })

  it('clears a previously-set result when the scenario prop changes', async () => {
    const { rerender } = render(
      <AIInsight companyId="comp1" scenario="valuation" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI-анализ модуля/ }))
    expect(await screen.findByText('Оценка выглядит заниженной.')).toBeInTheDocument()

    rerender(<AIInsight companyId="comp1" scenario="pnl" />)

    expect(
      screen.queryByText('Оценка выглядит заниженной.'),
    ).not.toBeInTheDocument()
  })

  it('clears a previously-set result when the companyId prop changes', async () => {
    const { rerender } = render(
      <AIInsight companyId="comp1" scenario="valuation" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /AI-анализ модуля/ }))
    expect(await screen.findByText('Оценка выглядит заниженной.')).toBeInTheDocument()

    rerender(<AIInsight companyId="comp2" scenario="valuation" />)

    expect(
      screen.queryByText('Оценка выглядит заниженной.'),
    ).not.toBeInTheDocument()
  })

  it('does not show an insight resolved after the scenario changed', async () => {
    let resolveInsight!: (value: typeof insightPayload) => void
    mocks.insight.mockImplementationOnce(
      () =>
        new Promise<typeof insightPayload>((resolve) => {
          resolveInsight = resolve
        }),
    )

    const { rerender } = render(
      <AIInsight companyId="comp1" scenario="valuation" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /AI-анализ модуля/ }))

    rerender(<AIInsight companyId="comp1" scenario="pnl" />)

    resolveInsight(insightPayload)
    await waitFor(() => expect(mocks.insight).toHaveBeenCalledTimes(1))
    await flushMicrotasks()

    expect(
      screen.queryByText('Оценка выглядит заниженной.'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('демо-режим')).not.toBeInTheDocument()
  })

  it('clears an error when the scenario prop changes', async () => {
    mocks.insight.mockRejectedValue({
      response: { data: { detail: 'Ошибка AI-анализа' } },
    })

    const { rerender } = render(
      <AIInsight companyId="comp1" scenario="valuation" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /AI-анализ модуля/ }))
    expect(await screen.findByText('Ошибка AI-анализа')).toBeInTheDocument()

    rerender(<AIInsight companyId="comp1" scenario="pnl" />)

    expect(screen.queryByText('Ошибка AI-анализа')).not.toBeInTheDocument()
  })
})
