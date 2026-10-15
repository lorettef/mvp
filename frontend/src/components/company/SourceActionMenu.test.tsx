import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SourceActionMenu } from './SourceActionMenu'

const label = 'Март 2026 · План'
describe('Source action menu keyboard contract', () => {
  it.each(['{Enter}', ' '])('opens with %s, navigates with arrows, Escape closes and restores focus', async key => {
    const user = userEvent.setup()
    render(<SourceActionMenu label={label} onEdit={vi.fn()} onDelete={vi.fn()} />)
    const trigger = screen.getByRole('button', { name: `Действия со строкой: ${label}` })
    trigger.focus()
    await user.keyboard(key)
    expect(screen.getAllByRole('menuitem')).toHaveLength(2)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'Удалить' })).toHaveFocus()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    expect(trigger).toHaveFocus()
  })
  it('selects an exact action once with keyboard and blocks a pending source', async () => {
    const onEdit = vi.fn(), onDelete = vi.fn(), user = userEvent.setup()
    const view = render(<SourceActionMenu label={label} onEdit={onEdit} onDelete={onDelete} source />)
    screen.getByRole('button').focus()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Редактировать источник' })).toHaveFocus())
    await user.keyboard('{Enter}')
    expect(onEdit).toHaveBeenCalledOnce()
    expect(onDelete).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument())
    view.rerender(<SourceActionMenu label={label} onEdit={onEdit} onDelete={onDelete} busy />)
    expect(screen.getByRole('button')).toBeDisabled()
    await user.click(screen.getByRole('button'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
