import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../store/authStore'
import { Dashboard } from './Dashboard'

const authStoreMock = vi.hoisted(() => ({ user: null as User | null }))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: authStoreMock.user }),
}))
vi.mock('./CompaniesDashboard', () => ({
  CompaniesDashboard: () => <div>Portfolio view</div>,
}))

const baseUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  fullName: 'Admin',
  companyName: 'Startup Engine',
  role: 'admin',
  organizationId: 'org-1',
  companyId: null,
  subscriptionPlan: 'pro',
  dailyLimit: 10,
  usedToday: 0,
}

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/companies/:companyId" element={<div>Company view</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('Dashboard routing', () => {
  beforeEach(() => {
    authStoreMock.user = null
  })

  it('renders the portfolio for a fund admin', () => {
    authStoreMock.user = { ...baseUser, organizationType: 'fund' }

    renderDashboard()

    expect(screen.getByText('Portfolio view')).toBeInTheDocument()
  })

  it('routes a standalone startup admin to its company', () => {
    authStoreMock.user = {
      ...baseUser,
      organizationType: 'startup',
      companyId: 'startup-company',
    }

    renderDashboard()

    expect(screen.getByText('Company view')).toBeInTheDocument()
  })

  it('routes a company user to its company', () => {
    authStoreMock.user = {
      ...baseUser,
      role: 'company',
      companyId: 'company-user-company',
    }

    renderDashboard()

    expect(screen.getByText('Company view')).toBeInTheDocument()
  })

  it('keeps legacy admins without organizationType on the portfolio', () => {
    authStoreMock.user = { ...baseUser }

    renderDashboard()

    expect(screen.getByText('Portfolio view')).toBeInTheDocument()
  })
})
