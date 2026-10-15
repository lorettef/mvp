import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
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

    fireEvent.click(screen.getByRole('button', { name: /Сформировать анализ/ }))

    await waitFor(() => expect(mocks.insight).toHaveBeenCalledWith('comp1', 'valuation'))
    expect(await screen.findByText('Оценка выглядит заниженной.')).toBeInTheDocument()
    expect(screen.getByText('демо-режим')).toBeInTheDocument()
  })

  it('clears a previously-set result when the scenario prop changes', async () => {
    const { rerender } = render(
      <AIInsight companyId="comp1" scenario="valuation" />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Сформировать анализ/ }))
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

    fireEvent.click(screen.getByRole('button', { name: /Сформировать анализ/ }))
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
    fireEvent.click(screen.getByRole('button', { name: /Сформировать анализ/ }))

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
    fireEvent.click(screen.getByRole('button', { name: /Сформировать анализ/ }))
    expect(await screen.findByText('Ошибка AI-анализа')).toBeInTheDocument()

    rerender(<AIInsight companyId="comp1" scenario="pnl" />)

    expect(screen.queryByText('Ошибка AI-анализа')).not.toBeInTheDocument()
  })

  it('does not generate automatically and guards rapid repeated clicks while pending', async () => {
    let resolve!: (value: typeof insightPayload) => void
    mocks.insight.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    render(<AIInsight companyId="comp1" scenario="overview" />)
    expect(mocks.insight).not.toHaveBeenCalled()
    const button = screen.getByRole('button', { name: 'Сформировать анализ' })
    fireEvent.click(button); fireEvent.click(button)
    expect(mocks.insight).toHaveBeenCalledTimes(1)
    expect(button).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Анализ...')
    await act(async () => resolve(insightPayload))
    expect(button).toBeEnabled()
  })

  it('shows a human error and Retry; structured text is rendered as escaped plain text', async () => {
    const text = 'Проблема\nНе хватает данных.\n\nПричина\nПо доступным данным достоверно определить причину нельзя.\n\nДействие\nСверьте периоды. <script>bad()</script>\nДедлайн: в течение 7 дней'
    mocks.insight.mockRejectedValueOnce({ response: { data: { detail: { secret: 'raw object' } } } })
      .mockResolvedValueOnce({ ...insightPayload, scenario: 'overview', text })
    const { container } = render(<AIInsight companyId="comp1" scenario="overview" />)
    fireEvent.click(screen.getByRole('button', { name: 'Сформировать анализ' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ошибка AI-анализа')
    expect(screen.queryByText(/raw object/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(await screen.findByText(/Не хватает данных/)).toHaveTextContent('Дедлайн: в течение 7 дней')
    expect(container.querySelector('script')).toBeNull()
    expect(mocks.insight).toHaveBeenCalledTimes(2)
  })

  it('marks the previous result as previous during regeneration', async () => {
    let resolve!: (value: typeof insightPayload) => void
    render(<AIInsight companyId="comp1" scenario="overview" />)
    fireEvent.click(screen.getByRole('button', { name: 'Сформировать анализ' }))
    await screen.findByText(insightPayload.text)
    mocks.insight.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    fireEvent.click(screen.getByRole('button', { name: 'Сформировать анализ' }))
    expect(screen.getByText(insightPayload.text)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('предыдущий результат')
    await act(async () => resolve({ ...insightPayload, text: 'Новый анализ' }))
    expect(screen.getByText('Новый анализ')).toBeInTheDocument()
  })

  it('does not let a pending old-company response populate the new company', async () => {
    let resolve!: (value: typeof insightPayload) => void
    mocks.insight.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const { rerender } = render(<AIInsight companyId="comp1" scenario="overview" />)
    fireEvent.click(screen.getByRole('button', { name: 'Сформировать анализ' }))
    rerender(<AIInsight companyId="comp2" scenario="overview" />)
    await act(async () => resolve(insightPayload))
    expect(screen.queryByText(insightPayload.text)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Сформировать анализ' })).toBeEnabled()
  })
})
