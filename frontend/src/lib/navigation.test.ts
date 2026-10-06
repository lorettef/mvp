import { describe, expect, it } from 'vitest'
import { globalNav } from './navigation'

describe('globalNav', () => {
  it('keeps Settings out of global navigation', () => {
    expect(globalNav.some((item) => item.href === '/settings' || item.key === 'settings' || item.labelKey === 'nav.settings')).toBe(false)
    expect(globalNav).toContainEqual({ key: 'dashboard', labelKey: 'nav.dashboard', href: '/dashboard' })
  })
})
