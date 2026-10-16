import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../store/authStore'
import { Dashboard } from './Dashboard'

const authStoreMock = vi.hoisted(() => ({ user: null as User | null }))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: authStoreMock.user }),
}))
vi.mock('./PortfolioHome', () => ({
  PortfolioHome: () => <div>Portfolio Home view</div>,
}))
vi.mock('./StartupProvisioning', () => ({
  StartupProvisioning: () => <div>First company provisioning</div>,
}))

const baseUser: User = {
  id: 'user-1',
  email: 'admin@example.com',
  fullName: 'Admin',
  companyName: 'Startup Investment Bridge',
  role: 'admin', productRole: 'fund',
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

    expect(screen.getByText('Portfolio Home view')).toBeInTheDocument()
  })

  it('routes a standalone startup admin to its company', () => {
    authStoreMock.user = {
      ...baseUser,
      organizationType: 'startup', productRole: 'startup',
      companyId: 'startup-company',
    }

    renderDashboard()

    expect(screen.getByText('Company view')).toBeInTheDocument()
  })

  it('routes a company user to its company', () => {
    authStoreMock.user = {
      ...baseUser,
      role: 'company', productRole: 'startup',
      companyId: 'company-user-company',
    }

    renderDashboard()

    expect(screen.getByText('Company view')).toBeInTheDocument()
  })

  it('uses server product role even when legacy organizationType is absent', () => {
    authStoreMock.user = { ...baseUser }

    renderDashboard()

    expect(screen.getByText('Portfolio Home view')).toBeInTheDocument()
  })
  it('does not infer fund rights from a legacy admin without product role', () => {
    authStoreMock.user = { ...baseUser, productRole: undefined }
    renderDashboard()
    expect(screen.getByText('Нет доступа', { exact: true })).toBeVisible()
    expect(screen.queryByText('Portfolio Home view')).not.toBeInTheDocument()
  })

  it('keeps an inconsistent startup without tenant context on the no-access page', () => {
    authStoreMock.user = { ...baseUser, productRole: 'startup', organizationId: null, companyId: 'own' }
    renderDashboard()
    expect(screen.getByText('Нет доступа', { exact: true })).toBeVisible()
    expect(screen.queryByText('Company view')).not.toBeInTheDocument()
  })

  it('routes investor to the portfolio without any company binding', () => {
    authStoreMock.user = { ...baseUser, role: 'observer', productRole: 'investor' }
    renderDashboard()
    expect(screen.getByText('Portfolio Home view')).toBeVisible()
  })

})
