import { describe, expect, it } from 'vitest'
import { canViewPortfolio, globalNav, isGlobalNavActive } from './navigation'

describe('globalNav', () => {
  it('keeps Settings out of global navigation', () => {
    expect(globalNav.some((item) => item.href === '/settings' || item.key === 'settings' || item.labelKey === 'nav.settings')).toBe(false)
    expect(globalNav).toContainEqual(expect.objectContaining({ key: 'dashboard', labelKey: 'nav.dashboard', href: '/dashboard' }))
  })

  it('defines fund visibility and Home label without changing startup labels', () => {
    expect(globalNav.find((item) => item.key === 'dashboard')?.portfolioLabelKey).toBe('nav.home')
    expect(globalNav.find((item) => item.key === 'companies')).toMatchObject({ href: '/companies', fundOnly: true, matchChildren: true })
    expect(canViewPortfolio({ role: 'admin', organizationType: 'fund' })).toBe(true)
    expect(canViewPortfolio({ role: 'admin' })).toBe(true)
    expect(canViewPortfolio({ role: 'admin', organizationType: 'startup' })).toBe(false)
    expect(canViewPortfolio({ role: 'company' })).toBe(false)
    expect(canViewPortfolio({ role: 'observer' })).toBe(false)
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
})
