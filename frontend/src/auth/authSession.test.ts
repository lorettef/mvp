import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore, type User } from '../store/authStore'
import type { UserResponse } from '../types/api'
import { authApi } from '../api/auth'
import {
  bootstrap,
  clearSession,
  completeLogin,
  getTenantKey,
  logout,
  registerQueryClient,
  resetBootstrap,
} from './authSession'

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

const userA: User = {
  id: 'user-a',
  email: 'a@org1.test',
  fullName: 'Admin A',
  companyName: 'Org 1',
  role: 'admin',
  organizationId: 'org-1',
  companyId: null,
  subscriptionPlan: 'pro',
  dailyLimit: null,
  usedToday: 0,
}

const userB: UserResponse = {
  id: 'user-b',
  email: 'b@org2.test',
  fullName: 'Admin B',
  companyName: 'Org 2',
  role: 'admin',
  organizationId: 'org-2',
  companyId: null,
  createdAt: '2025-01-01T00:00:00Z',
  subscriptionPlan: 'pro',
  dailyLimit: null,
  usedToday: 0,
}

// Свежий ответ сервера, ЗАВЕДОМО отличающийся от persisted userA:
// если revalidate не сработал, стор останется на userA и тест упадёт.
const freshUserC: UserResponse = {
  id: 'user-c',
  email: 'c@org3.test',
  fullName: 'Fresh Admin C',
  companyName: 'Org 3',
  role: 'member',
  organizationId: 'org-3',
  companyId: 'company-c',
  createdAt: '2025-02-02T00:00:00Z',
  subscriptionPlan: 'business',
  dailyLimit: 100,
  usedToday: 7,
}

describe('authSession', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    vi.restoreAllMocks()
    queryClient = new QueryClient()
    registerQueryClient(queryClient)
    useAuthStore.setState({ user: null })
    resetBootstrap()
  })

  it('clears the query cache before setting the new user on login', () => {
    queryClient.setQueryData(['dashboard'], { orgA: true })

    completeLogin(userB)

    // Реальный стейт кэша, а не факт вызова функции:
    expect(queryClient.getQueriesData({})).toHaveLength(0)
    expect(useAuthStore.getState().user).toEqual({
      id: 'user-b',
      email: 'b@org2.test',
      fullName: 'Admin B',
      companyName: 'Org 2',
      role: 'admin',
      organizationId: 'org-2',
      companyId: null,
      subscriptionPlan: 'pro',
      dailyLimit: null,
      usedToday: 0,
    })
  })

  it('clears cache, nulls user and wipes persisted storage on logout', async () => {
    queryClient.setQueryData(['dashboard'], { orgA: true })
    useAuthStore.setState({ user: userA })
    const clearStorageSpy = vi.spyOn(useAuthStore.persist, 'clearStorage')

    await logout()

    expect(queryClient.getQueriesData({})).toHaveLength(0)
    expect(useAuthStore.getState().user).toBeNull()
    expect(clearStorageSpy).toHaveBeenCalledTimes(1)
  })

  it('clearSession: synchronously clears cache, store user and persisted storage', () => {
    queryClient.setQueryData(['dashboard'], { orgA: true })
    useAuthStore.setState({ user: userA })
    const clearStorageSpy = vi.spyOn(useAuthStore.persist, 'clearStorage')

    clearSession()

    expect(queryClient.getQueriesData({})).toHaveLength(0)
    expect(useAuthStore.getState().user).toBeNull()
    expect(clearStorageSpy).toHaveBeenCalledTimes(1)
  })

  it('logout: warns on a server error and still clears local state', async () => {
    queryClient.setQueryData(['dashboard'], { orgA: true })
    useAuthStore.setState({ user: userA })
    vi.mocked(authApi.logout).mockRejectedValue({ response: { status: 500 } })

    await logout()

    expect(vi.mocked(toast.warning)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.warning)).toHaveBeenCalledWith('Не удалось завершить сессию на сервере')
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueriesData({})).toHaveLength(0)
  })

  it('logout: stays silent on a network error but still clears local state', async () => {
    queryClient.setQueryData(['dashboard'], { orgA: true })
    useAuthStore.setState({ user: userA })
    vi.mocked(authApi.logout).mockRejectedValue(new Error('Network Error'))

    await logout()

    expect(vi.mocked(toast.warning)).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueriesData({})).toHaveLength(0)
  })

  it('logout: a 401 from the logout endpoint does not toast and still clears local state', async () => {
    useAuthStore.setState({ user: userA })
    vi.mocked(authApi.logout).mockRejectedValue({ response: { status: 401 } })

    await logout()

    expect(vi.mocked(toast.warning)).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('falls back to user.id as tenant key when organizationId is null', () => {
    const userNoOrg: User = { ...userA, id: 'user-no-org', organizationId: null }
    useAuthStore.setState({ user: userNoOrg })

    expect(getTenantKey()).toBe('user-no-org')
  })

  it('returns empty tenant key when no user is set', () => {
    expect(getTenantKey()).toBe('')
  })

  it('bootstrap: skips network when there is no persisted user', async () => {
    useAuthStore.setState({ user: null })

    await bootstrap()

    expect(authApi.me).not.toHaveBeenCalled()
  })

  it('bootstrap: revalidates and overwrites stale persisted user with fresh server data', async () => {
    useAuthStore.setState({ user: userA })
    vi.mocked(authApi.me).mockResolvedValue(freshUserC)

    await bootstrap()

    // Ассерт по РЕАЛЬНОМУ стейту стора, а не по факту вызова me():
    // store.user обязан содержать именно данные freshUserC.
    expect(authApi.me).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user).toEqual({
      id: 'user-c',
      email: 'c@org3.test',
      fullName: 'Fresh Admin C',
      companyName: 'Org 3',
      role: 'member',
      organizationId: 'org-3',
      companyId: 'company-c',
      subscriptionPlan: 'business',
      dailyLimit: 100,
      usedToday: 7,
    })
  })

  it('bootstrap: on me() failure logs out — user null and query cache empty', async () => {
    useAuthStore.setState({ user: userA })
    queryClient.setQueryData(['dashboard'], { orgA: true })
    vi.mocked(authApi.me).mockRejectedValue(new Error('401 Unauthorized'))

    await bootstrap()

    expect(useAuthStore.getState().user).toBeNull()
    expect(queryClient.getQueriesData({})).toHaveLength(0)
  })

  it('bootstrap: runs its network call at most once even when invoked twice', async () => {
    useAuthStore.setState({ user: userA })
    vi.mocked(authApi.me).mockResolvedValue(freshUserC)

    // Имитация React 18 StrictMode double-effect: второй вызов — no-op
    // благодаря синхронно выставленному single-flight флагу.
    await bootstrap()
    await bootstrap()

    expect(authApi.me).toHaveBeenCalledTimes(1)
  })
})
