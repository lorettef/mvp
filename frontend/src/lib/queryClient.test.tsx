import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query'
import { CanceledError } from 'axios'
import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createQueryClient } from './queryClient'
import { getErrorMessage, isCancellation, SKIP_GLOBAL_ERROR } from './toastError'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
  Toaster: () => null,
}))

const toastError = vi.mocked(toast.error)

function FailingMutation({ error, meta }: { error: Error; meta?: { skipGlobalError?: boolean } }) {
  const mutation = useMutation<unknown, Error, Error>({
    mutationFn: (e) => Promise.reject(e),
    meta,
  })
  return (
    <div>
      <button onClick={() => mutation.mutate(error)}>go</button>
      <span data-testid="status">{mutation.isPending ? 'pending' : 'settled'}</span>
    </div>
  )
}

function FailingQuery() {
  const query = useQuery({
    queryKey: ['global-error-test'],
    queryFn: () => Promise.reject(new Error('query boom')),
    retry: false,
  })
  return <span data-testid="status">{query.status}</span>
}

function renderWithClient(ui: ReactElement) {
  return render(<QueryClientProvider client={createQueryClient()}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('global query/mutation error toasts', () => {
  it('toasts exactly once when a mutation fails without a local handler', async () => {
    renderWithClient(<FailingMutation error={new Error('boom')} />)
    fireEvent.click(screen.getByText('go'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('settled'))
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('boom')
  })

  it('does not toast when meta.skipGlobalError is set', async () => {
    renderWithClient(<FailingMutation error={new Error('boom')} meta={SKIP_GLOBAL_ERROR} />)
    fireEvent.click(screen.getByText('go'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('settled'))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('does not toast on cancelled requests', async () => {
    renderWithClient(<FailingMutation error={new CanceledError('canceled')} />)
    fireEvent.click(screen.getByText('go'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('settled'))
    expect(toastError).not.toHaveBeenCalled()
  })

  it('toasts once on query failures via the QueryCache', async () => {
    renderWithClient(<FailingQuery />)
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('error'))
    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError).toHaveBeenCalledWith('query boom')
  })
})

describe('getErrorMessage', () => {
  it('prefers the backend detail field', () => {
    expect(getErrorMessage({ response: { data: { detail: 'Email already registered' } } })).toBe(
      'Email already registered'
    )
  })

  it('falls back to the error message when detail is missing', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('falls back to a generic message otherwise', () => {
    expect(getErrorMessage({})).toBe('Something went wrong. Please try again.')
  })
})

describe('isCancellation', () => {
  it('recognizes axios CanceledError', () => {
    expect(isCancellation(new CanceledError('canceled'))).toBe(true)
  })

  it('recognizes errors named CanceledError', () => {
    expect(isCancellation({ name: 'CanceledError' })).toBe(true)
  })

  it('rejects regular errors', () => {
    expect(isCancellation(new Error('boom'))).toBe(false)
  })
})
