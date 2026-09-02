import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { QueryState } from './QueryState'

describe('QueryState', () => {
  it('renders a skeleton while loading and hides children', () => {
    const { container } = render(
      <QueryState isLoading>
        <div>content</div>
      </QueryState>
    )
    expect(screen.getByTestId('query-state-loading')).toBeInTheDocument()
    expect(container.querySelector('.animate-pulse')).not.toBeNull()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('renders the error text and a retry button that calls onRetry', () => {
    const onRetry = vi.fn()
    render(
      <QueryState isError error={new Error('Request failed with status code 403')} onRetry={onRetry}>
        <div>content</div>
      </QueryState>
    )
    expect(screen.getByTestId('query-state-error')).toBeInTheDocument()
    expect(screen.getByText('Request failed with status code 403')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('shows the backend detail message for API-shaped errors', () => {
    render(
      <QueryState isError error={{ response: { data: { detail: 'Нет доступа' } } }}>
        <div>content</div>
      </QueryState>
    )
    expect(screen.getByText('Нет доступа')).toBeInTheDocument()
  })

  it('renders the empty text when isEmpty and hides children', () => {
    render(
      <QueryState isEmpty emptyText="Данные ещё не рассчитаны.">
        <div>content</div>
      </QueryState>
    )
    expect(screen.getByTestId('query-state-empty')).toBeInTheDocument()
    expect(screen.getByText('Данные ещё не рассчитаны.')).toBeInTheDocument()
    expect(screen.queryByText('content')).not.toBeInTheDocument()
  })

  it('renders children when not loading, not errored and not empty', () => {
    render(
      <QueryState>
        <div>content</div>
      </QueryState>
    )
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(screen.queryByTestId('query-state-loading')).not.toBeInTheDocument()
    expect(screen.queryByTestId('query-state-error')).not.toBeInTheDocument()
    expect(screen.queryByTestId('query-state-empty')).not.toBeInTheDocument()
  })
})
