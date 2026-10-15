import { render, screen } from '@testing-library/react'
import { Outlet, useParams, useSearchParams } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/store/authStore'
import App from './App'

const auth = vi.hoisted(() => ({ user: null as User | null }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: auth.user }) }))
vi.mock('@/auth/authSession', () => ({ registerQueryClient: vi.fn(), bootstrap: vi.fn() }))
vi.mock('@/components/common/Layout', () => ({ Layout: () => <Outlet /> }))
vi.mock('@/pages/PortfolioHome', () => ({ PortfolioHome: () => <h1>Portfolio Home</h1> }))
vi.mock('@/pages/CompaniesDashboard', () => ({ CompaniesDashboard: () => <h1>Companies management</h1> }))
vi.mock('@/pages/StartupDashboard', () => ({ StartupDashboard: ({ companyId }: { companyId: string }) => <h1>Startup {companyId}</h1> }))
vi.mock('@/pages/Login', () => ({ Login: () => <h1>Login</h1> }))
vi.mock('@/pages/CompanyDetail', () => ({ CompanyDetail: () => {
  const { companyId } = useParams()
  const [params] = useSearchParams()
  return <h1>Profile {companyId} {params.get('tab') ?? 'metrics'}</h1>
} }))

const baseUser: User = { id: 'u', email: 'u@example.test', fullName: 'User', companyName: '', role: 'admin',
  organizationId: 'org', organizationType: 'fund', companyId: null, subscriptionPlan: 'pro', dailyLimit: 10, usedToday: 0 }
function open(path: string) { window.history.replaceState({}, '', path); render(<App />) }
beforeEach(() => { auth.user = { ...baseUser } })

describe('registered portfolio routes and access policy', () => {
  it('renders separate fund Home and Companies routes', async () => {
    open('/companies')
    expect(await screen.findByRole('heading', { name: 'Companies management' })).toBeVisible()
    expect(window.location.pathname).toBe('/companies')
  })
  it('dispatches fund dashboard to Portfolio Home', async () => {
    open('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Portfolio Home' })).toBeVisible()
  })
  it.each(['company', 'admin'] as const)('redirects startup %s from Companies to its own existing dashboard', async (role) => {
    auth.user = { ...baseUser, role, organizationType: 'startup', companyId: 'own' }
    open('/companies')
    expect(await screen.findByRole('heading', { name: 'Startup own' })).toBeVisible()
    expect(window.location.pathname).toBe('/dashboard')
    expect(screen.queryByRole('heading', { name: 'Companies management' })).not.toBeInTheDocument()
  })
  it('redirects unauthenticated Companies to login through ProtectedRoute', async () => {
    auth.user = null
    open('/companies')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeVisible()
    expect(window.location.pathname).toBe('/login')
  })
  it('keeps observer without company in no-access state without a redirect loop', async () => {
    auth.user = { ...baseUser, role: 'observer' }
    open('/companies')
    expect(await screen.findByText('Нет доступа', { exact: true })).toBeVisible()
    expect(window.location.pathname).toBe('/dashboard')
  })
  it.each(['/companies/comp1', '/companies/comp1?tab=pnl'])('preserves profile deep link %s', async (path) => {
    open(path)
    expect(await screen.findByRole('heading', { name: path.includes('?') ? 'Profile comp1 pnl' : 'Profile comp1 metrics' })).toBeVisible()
    expect(`${window.location.pathname}${window.location.search}`).toBe(path)
  })
})
