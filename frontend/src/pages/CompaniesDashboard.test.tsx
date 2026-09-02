import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CompaniesDashboard } from './CompaniesDashboard'

const companiesApiMock = vi.hoisted(() => ({
  create: vi.fn(),
}))

const dashboardApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

const invitesApiMock = vi.hoisted(() => ({
  create: vi.fn(),
}))

const authStoreMock = vi.hoisted(() => ({
  user: { role: 'admin' },
}))

vi.mock('@/api/companies', () => ({
  companiesApi: companiesApiMock,
  dashboardApi: dashboardApiMock,
}))
vi.mock('@/api/invites', () => ({ invitesApi: invitesApiMock }))
vi.mock('../auth/authSession', () => ({ getTenantKey: () => 'org-1' }))
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: authStoreMock.user }),
}))

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CompaniesDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('CompaniesDashboard startup invites', () => {
  beforeEach(() => {
    companiesApiMock.create.mockReset()
    dashboardApiMock.get.mockReset()
    dashboardApiMock.get.mockResolvedValue({
      totalCompanies: 0,
      avgRevenue: null,
      onTrack: 0,
      behind: 0,
      companies: [],
    })
    invitesApiMock.create.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    })
  })

  it('creates an invite and reveals the full startup link', async () => {
    invitesApiMock.create.mockResolvedValue({
      token: 'startup-token',
      expiresAt: '2026-09-09T00:00:00Z',
      email: null,
    })

    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))

    await waitFor(() => expect(invitesApiMock.create).toHaveBeenCalledWith())

    const linkInput = await screen.findByDisplayValue(/\/invite\/startup-token/)
    expect(linkInput.getAttribute('value')).toContain('/invite/startup-token')
  })

  it('copies the revealed invite link to the clipboard', async () => {
    invitesApiMock.create.mockResolvedValue({
      token: 'copy-token',
      expiresAt: '2026-09-09T00:00:00Z',
      email: null,
    })

    renderDashboard()
    fireEvent.click(await screen.findByRole('button', { name: 'Пригласить стартап' }))
    const linkInput = await screen.findByDisplayValue(/\/invite\/copy-token/)

    fireEvent.click(screen.getByRole('button', { name: 'Копировать' }))

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(linkInput.getAttribute('value')),
    )
    expect(await screen.findByText('Скопировано')).toBeInTheDocument()
  })
})
