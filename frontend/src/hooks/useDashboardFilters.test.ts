import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useDashboardFilters } from './useDashboardFilters'

describe('useDashboardFilters', () => {
  it('starts with an empty contract and reset disabled', () => {
    const { result } = renderHook(useDashboardFilters)
    expect(result.current.filters).toEqual({})
    expect(result.current.appliedFilters).toEqual({})
    expect(result.current.activeGroups).toBe(0)
    expect(result.current.canReset).toBe(false)
  })

  it('counts selected groups, not selected items or both date bounds', () => {
    const { result } = renderHook(useDashboardFilters)
    act(() => result.current.updateFilters({ companyIds: ['c', 'b', 'a'], industries: ['saas', 'fintech'],
      periodFrom: '2026-01-01', periodTo: '2026-02-01' }))
    expect(result.current.activeGroups).toBe(3)
    expect(result.current.appliedFilters.companyIds).toEqual(['a', 'b', 'c'])
  })

  it('does not apply an initially inverted range', () => {
    const { result } = renderHook(useDashboardFilters)
    act(() => result.current.updateFilters({ periodFrom: '2026-03-01', periodTo: '2026-02-01' }))
    expect(result.current.invalidRange).toBe(true)
    expect(result.current.appliedFilters).toEqual({})
    expect(result.current.canReset).toBe(true)
  })

  it('retains last valid dates while allowing metadata changes and later correction', () => {
    const { result } = renderHook(useDashboardFilters)
    act(() => result.current.updateFilters({ periodFrom: '2026-01-01', periodTo: '2026-02-01' }))
    act(() => result.current.updateFilters({ periodFrom: '2026-03-01', periodTo: '2026-02-01', health: ['healthy'] }))
    expect(result.current.appliedFilters).toEqual({ periodFrom: '2026-01-01', periodTo: '2026-02-01', health: ['healthy'] })
    act(() => result.current.updateFilters({ ...result.current.filters, periodTo: undefined }))
    expect(result.current.invalidRange).toBe(false)
    expect(result.current.appliedFilters).toEqual({ periodFrom: '2026-03-01', health: ['healthy'] })
  })

  it('resets every dimension and the last-valid period', () => {
    const { result } = renderHook(useDashboardFilters)
    act(() => result.current.updateFilters({ companyIds: ['a'], industries: ['saas'], health: ['healthy'],
      performanceStatus: ['on_track'], periodFrom: '2026-01-01', periodTo: '2026-02-01' }))
    act(() => result.current.resetFilters())
    expect(result.current.filters).toEqual({})
    expect(result.current.appliedFilters).toEqual({})
    expect(result.current.activeGroups).toBe(0)
    expect(result.current.canReset).toBe(false)
  })
})
