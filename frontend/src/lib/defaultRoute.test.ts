import { describe, expect, it } from 'vitest'
import { getDefaultRoute } from './defaultRoute'

describe('role-aware entry route', () => {
  const actor = { organizationId: 'tenant', companyId: 'own' }

  it.each([
    ['fund', '/dashboard'],
    ['investor', '/dashboard'],
    ['startup', '/companies/own'],
  ] as const)('routes %s to %s', (productRole, expected) => {
    expect(getDefaultRoute({ ...actor, productRole })).toBe(expected)
  })

  it('keeps an unbound startup on first-company provisioning', () => {
    expect(getDefaultRoute({ ...actor, productRole: 'startup', companyId: null })).toBe('/dashboard')
  })

  it('denies missing, stale and unrecognized contexts', () => {
    expect(getDefaultRoute(null)).toBeNull()
    expect(getDefaultRoute({ ...actor, productRole: null })).toBeNull()
    expect(getDefaultRoute({ ...actor, productRole: undefined })).toBeNull()
    expect(getDefaultRoute({ ...actor, productRole: 'fund', organizationId: null })).toBeNull()
  })
})
