import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useAuthStore, type ProductRole, type User } from '@/store/authStore'
import { getPermissions } from '@/lib/permissions'
import { usePermissions } from './usePermissions'

const actor = (productRole: ProductRole): User => ({
  id: 'actor', email: '', fullName: '', companyName: '', role: 'admin',
  productRole, organizationId: 'org', companyId: 'own', subscriptionPlan: 'pro',
  dailyLimit: null, usedToday: 0,
})
afterEach(() => useAuthStore.getState().setUser(null))

describe('product capabilities', () => {
  it.each([
    ['fund', true, true, false, true, true, true],
    ['startup', false, true, true, false, true, false],
    ['investor', true, false, false, false, false, false],
  ] as const)('%s grants only its product actions', (role, portfolio, open, edit, invite, companyAI, portfolioAI) => {
    const permissions = getPermissions(actor(role))
    expect(permissions.canViewPortfolio).toBe(portfolio)
    expect(permissions.canViewCompanyList).toBe(portfolio)
    expect(permissions.canOpenCompany('own')).toBe(open)
    expect(permissions.canEditSourceData('own')).toBe(edit)
    expect(permissions.canUseDataEntry('own')).toBe(edit)
    expect(permissions.canInvite).toBe(invite)
    expect(permissions.canUseCompanyAI('own')).toBe(companyAI)
    expect(permissions.canUsePortfolioAI).toBe(portfolioAI)
    expect(permissions.canComment).toBe(role === 'fund')
    expect(permissions.canCorrect).toBe(role === 'fund')
    expect(permissions.canManagePortfolio).toBe(role === 'fund')
  })

  it('bounds startup actions to own company and fails closed for stale identities', () => {
    const permissions = getPermissions(actor('startup'))
    expect(permissions.canOpenCompany('sibling')).toBe(false)
    expect(permissions.canEditSourceData('sibling')).toBe(false)
    expect(permissions.canUseCompanyAI('sibling')).toBe(false)
    for (const user of [null, { ...actor('fund'), productRole: undefined }, { ...actor('fund'), organizationId: null }]) {
      expect(getPermissions(user).canViewPortfolio).toBe(false)
      expect(getPermissions(user).canOpenCompany('own')).toBe(false)
    }
  })

  it('rerenders on server role changes and grants nothing while session is pending', () => {
    useAuthStore.getState().setUser(actor('fund'))
    const hook = renderHook(usePermissions)
    expect(hook.result.current.canUseCompanyAI('own')).toBe(true)
    act(() => useAuthStore.getState().setUser(actor('investor')))
    expect(hook.result.current.canUseCompanyAI('own')).toBe(false)
    expect(hook.result.current.canViewPortfolio).toBe(true)
    act(() => useAuthStore.getState().setSessionPending())
    expect(hook.result.current.canViewPortfolio).toBe(false)
  })
})
