import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CommentButton } from './CommentButton'
import i18n from '@/i18n'
import type { ReviewComment } from '@/types/api'

const sample: ReviewComment = {
  id: 'c1', companyId: 'own', authorId: 'fund', authorName: 'Fund reviewer',
  targetType: 'overview', metricId: null, field: null, indicatorKey: null,
  targetPeriod: null, targetScenario: null, text: '<script>alert(1)</script>\nReview text',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('Fund review comment dialog', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('creates a trimmed comment exactly once, keeps the dialog open and clears the draft', async () => {
    let resolve!: () => void
    const onCreate = vi.fn(() => new Promise<void>(done => { resolve = done }))
    render(<CommentButton label="Обзор компании" target={{ target_type: 'overview' }} comments={[]} canCreate onCreate={onCreate} />)
    fireEvent.click(screen.getByRole('button', { name: /Комментарии: Обзор компании/ }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Пока комментариев нет')
    const submit = screen.getByRole('button', { name: 'Добавить комментарий' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Комментарий' }), { target: { value: '  Review  ' } })
    fireEvent.click(submit)
    fireEvent.click(submit)
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith({ target_type: 'overview', text: 'Review' })
    resolve()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Комментарий' })).toHaveValue(''))
    expect(dialog).toBeInTheDocument()
  })

  it('shows Startup immutable text safely without compose controls', () => {
    render(<CommentButton label="Обзор компании" target={{ target_type: 'overview' }} comments={[sample]} canCreate={false} onCreate={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Комментарии: Обзор компании, 1/ }))
    expect(screen.getByText(/Review text/)).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Добавить комментарий' })).not.toBeInTheDocument()
  })

  it('keeps empty Startup targets quiet and exposes load failures to Fund', () => {
    const { rerender } = render(<CommentButton label="Revenue" target={{ target_type: 'overview' }} comments={[]} canCreate={false} onCreate={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Комментарии: Revenue/ })).not.toBeInTheDocument()
    const retry = vi.fn()
    rerender(<CommentButton label="Revenue" target={{ target_type: 'overview' }} comments={[]} canCreate onCreate={vi.fn()} error onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: /Комментарии: Revenue/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Ошибка загрузки комментариев')
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
