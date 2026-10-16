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
vi.mock('@/pages/StartupProvisioning', () => ({ StartupProvisioning: () => <h1>First company provisioning</h1> }))
vi.mock('@/pages/Login', () => ({ Login: () => <h1>Login</h1> }))
vi.mock('@/pages/CompanyDetail', () => ({ CompanyDetail: () => {
  const { companyId } = useParams()
  const [params] = useSearchParams()
  return <h1>Profile {companyId} {params.get('tab') ?? 'metrics'}</h1>
} }))

const baseUser: User = { id: 'u', email: 'u@example.test', fullName: 'User', companyName: '', role: 'admin', productRole: 'fund',
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
  it.each(['company', 'admin'] as const)('redirects startup %s from Companies to its own profile', async (role) => {
    auth.user = { ...baseUser, role, productRole: 'startup', organizationType: 'startup', companyId: 'own' }
    open('/companies')
    expect(await screen.findByRole('heading', { name: 'Profile own metrics' })).toBeVisible()
    expect(window.location.pathname).toBe('/companies/own')
    expect(screen.queryByRole('heading', { name: 'Companies management' })).not.toBeInTheDocument()
  })
  it('redirects a bound startup from dashboard to its own profile without mounting the old dashboard', async () => {
    auth.user = { ...baseUser, productRole: 'startup', companyId: 'own' }
    open('/dashboard')
    expect(await screen.findByRole('heading', { name: 'Profile own metrics' })).toBeVisible()
    expect(window.location.pathname).toBe('/companies/own')
    expect(screen.queryByRole('heading', { name: 'First company provisioning' })).not.toBeInTheDocument()
  })
  it('shows existing first-company provisioning only for an unbound startup', async () => {
    auth.user = { ...baseUser, productRole: 'startup', companyId: null }
    open('/dashboard')
    expect(await screen.findByRole('heading', { name: 'First company provisioning' })).toBeVisible()
    expect(window.location.pathname).toBe('/dashboard')
  })
  it('redirects unauthenticated Companies to login through ProtectedRoute', async () => {
    auth.user = null
    open('/companies')
    expect(await screen.findByRole('heading', { name: 'Login' })).toBeVisible()
    expect(window.location.pathname).toBe('/login')
  })
  it('admits investor without a company to portfolio views', async () => {
    auth.user = { ...baseUser, role: 'observer', productRole: 'investor' }
    open('/companies')
    expect(await screen.findByRole('heading', { name: 'Companies management' })).toBeVisible()
    expect(window.location.pathname).toBe('/companies')
  })
  it.each(['/companies/comp1', '/companies/comp1?tab=pnl'])('preserves profile deep link %s', async (path) => {
    open(path)
    expect(await screen.findByRole('heading', { name: path.includes('?') ? 'Profile comp1 pnl' : 'Profile comp1 metrics' })).toBeVisible()
    expect(`${window.location.pathname}${window.location.search}`).toBe(path)
  })
})
