import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { InvitePage } from './InvitePage'

const invitesApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/invites', () => ({ invitesApi: invitesApiMock }))

function renderInviteRoute(token = 'invite-token') {
  return render(
    <MemoryRouter initialEntries={[`/invite/${token}`]}>
      <Routes>
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/register" element={<div>Registration page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('InvitePage', () => {
  beforeEach(() => {
    invitesApiMock.get.mockReset()
  })

  it('shows the organization name and navigates to invite registration for a valid token', async () => {
    invitesApiMock.get.mockResolvedValue({
      organizationName: 'North Star Ventures',
      email: 'founder@example.com',
    })

    renderInviteRoute()

    expect(await screen.findByText('Вас пригласили в фонд «North Star Ventures»')).toBeInTheDocument()
    const cta = screen.getByRole('button', { name: 'Зарегистрироваться' })

    fireEvent.click(cta)

    expect(await screen.findByText('Registration page')).toBeInTheDocument()
    expect(invitesApiMock.get).toHaveBeenCalledWith('invite-token', expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('shows an invalid message when the public token lookup fails', async () => {
    invitesApiMock.get.mockRejectedValue(new Error('not found'))

    renderInviteRoute('expired-token')

    await waitFor(() => {
      expect(screen.getByText('Приглашение недействительно или истекло')).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: 'Зарегистрироваться' })).not.toBeInTheDocument()
  })
})
