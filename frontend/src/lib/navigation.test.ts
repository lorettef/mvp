import { describe, expect, it } from 'vitest'
import { canViewPortfolio, companyTabKeys, globalNav, isGlobalNavActive, resolveCompanyTab } from './navigation'

describe('globalNav', () => {
  it('keeps Settings out of global navigation', () => {
    expect(globalNav.some((item) => item.href === '/settings' || item.key === 'settings' || item.labelKey === 'nav.settings')).toBe(false)
    expect(globalNav).toContainEqual(expect.objectContaining({ key: 'dashboard', labelKey: 'nav.home', href: '/dashboard' }))
  })

  it('defines fund visibility and Home label without changing startup labels', () => {
    expect(globalNav.find((item) => item.key === 'dashboard')?.labelKey).toBe('nav.home')
    expect(globalNav.find((item) => item.key === 'companies')).toMatchObject({ href: '/companies', matchChildren: true })
    const context = { organizationId: 'org', companyId: null }
    expect(canViewPortfolio({ ...context, productRole: 'fund' })).toBe(true)
    expect(canViewPortfolio({ ...context, productRole: 'investor' })).toBe(true)
    expect(canViewPortfolio({ ...context, productRole: 'startup' })).toBe(false)
    expect(canViewPortfolio(context)).toBe(false)
    expect(canViewPortfolio(null)).toBe(false)
  })

  it('matches company descendants at path boundaries and keeps Home exact', () => {
    const companies = globalNav.find((item) => item.key === 'companies')!
    const home = globalNav.find((item) => item.key === 'dashboard')!
    expect(isGlobalNavActive(companies, '/companies')).toBe(true)
    expect(isGlobalNavActive(companies, '/companies/comp1')).toBe(true)
    expect(isGlobalNavActive(companies, '/companies-other')).toBe(false)
    expect(isGlobalNavActive(home, '/dashboard')).toBe(true)
    expect(isGlobalNavActive(home, '/companies/comp1')).toBe(false)
    expect(isGlobalNavActive(home, '/dashboard-other')).toBe(false)
  })

  it('defaults missing or unknown company tabs to Overview without changing existing keys', () => {
    expect(companyTabKeys.slice(0, 6)).toEqual(['overview', 'metrics', 'unit', 'pnl', 'cashflow', 'budget'])
    expect(resolveCompanyTab(null)).toBe('overview')
    expect(resolveCompanyTab('unknown')).toBe('overview')
    for (const key of companyTabKeys) expect(resolveCompanyTab(key)).toBe(key)
  })
})
