import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import type { UserResponse } from '../types/api'
import { createQueryClient } from '../lib/queryClient'
import { qk } from '../lib/queryKeys'
import {
  completeLogin,
  getTenantKey,
  logout,
  registerQueryClient,
} from './authSession'

// authApi is fully mocked — this integration test makes no real HTTP calls.
vi.mock('../api/auth', () => ({
  authApi: {
    logout: vi.fn().mockResolvedValue(undefined),
    login: vi.fn(),
    me: vi.fn(),
    register: vi.fn(),
    seed: vi.fn(),
  },
}))

vi.mock('sonner', () => ({
  toast: { warning: vi.fn(), error: vi.fn() },
}))

const adminA: UserResponse = {
  id: 'user-a',
  email: 'admin-a@orga.test',
  fullName: 'Admin A',
  companyName: 'Accelerator Alpha',
  role: 'admin',
  organizationId: 'orgA',
  companyId: null,
  createdAt: '2025-01-01T00:00:00Z',
  subscriptionPlan: 'pro',
  dailyLimit: null,
  usedToday: 0,
}

const adminB: UserResponse = {
  id: 'user-b',
  email: 'admin-b@orgb.test',
  fullName: 'Admin B',
  companyName: 'Accelerator Beta',
  role: 'admin',
  organizationId: 'orgB',
  companyId: null,
  createdAt: '2025-02-02T00:00:00Z',
  subscriptionPlan: 'business',
  dailyLimit: 100,
  usedToday: 7,
}

// Payload that admin A's dashboard query would resolve with.
const orgADashboard = {
  totalCompanies: 3,
  companies: [{ id: 'cA', name: 'Alpha' }],
}

const orgBDashboard = {
  totalCompanies: 1,
  companies: [{ id: 'cB', name: 'Beta' }],
}

describe('cross-tenant cache isolation (C1 regression)', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.restoreAllMocks()
    useAuthStore.setState({ user: null })
    queryClient = createQueryClient()
    registerQueryClient(queryClient)
  })

  it('admin B never observes admin A cached data after logout + login', async () => {
    // 1. Admin A logs in; the dashboard query resolves into the cache.
    completeLogin(adminA)
    queryClient.setQueryData(qk.dashboard('orgA'), orgADashboard)

    // 2. Org-A data is cached under its tenant-scoped key.
    expect(getTenantKey()).toBe('orgA')
    expect(queryClient.getQueryData(qk.dashboard('orgA'))).toEqual(orgADashboard)

    // 3. Admin A logs out — the whole cache is wiped synchronously.
    await logout()
    expect(getTenantKey()).toBe('')
    expect(queryClient.getQueriesData({})).toHaveLength(0)

    // 4. Admin B logs in; B's own dashboard query resolves.
    completeLogin(adminB)
    queryClient.setQueryData(qk.dashboard('orgB'), orgBDashboard)

    // 5. The org-A key must be GONE — real cache state, not a spy assertion.
    expect(queryClient.getQueryData(qk.dashboard('orgA'))).toBeUndefined()

    // 6. The org-B tenant subtree contains only org-B data.
    const orgBEntries = queryClient.getQueriesData({ queryKey: ['tenant', 'orgB'] })
    expect(orgBEntries).toHaveLength(1)
    expect(orgBEntries[0][0]).toEqual(qk.dashboard('orgB'))
    expect(orgBEntries[0][1]).toEqual(orgBDashboard)

    // 7. No entry anywhere in the whole cache carries org-A data.
    const allEntries = queryClient.getQueriesData({})
    expect(allEntries).toHaveLength(1)
    for (const [key, data] of allEntries) {
      expect(JSON.stringify(key)).not.toContain('orgA')
      expect(data).not.toEqual(orgADashboard)
    }

    // Bonus: the tenant key now resolves to org B.
    expect(getTenantKey()).toBe('orgB')
  })
})
