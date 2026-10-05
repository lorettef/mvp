import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { qk } from './queryKeys'
import type { DashboardFilters } from '@/types/api'

const sortKeys = (keys: readonly (readonly unknown[])[]) =>
  keys.map((k) => JSON.stringify(k)).sort()

describe('qk (tenant-scoped query keys)', () => {
  it('separates org A from org B', () => {
    expect(qk.dashboard('orgA')).not.toEqual(qk.dashboard('orgB'))
    expect(qk.companyMetrics('orgA', 'c1')).not.toEqual(qk.companyMetrics('orgB', 'c1'))
  })

  it('builds full key arrays exactly', () => {
    expect(qk.dashboard('orgA')).toEqual(['tenant', 'orgA', 'dashboard'])
    expect(qk.company('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1'])
    expect(qk.companyMetrics('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'metrics'])
    expect(qk.companyCohorts('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'cohorts'])
    expect(qk.companyBudgets('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'budgets'])
    expect(qk.companyUnitEconomics('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'unit-economics'])
    expect(qk.companyTasks('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'tasks'])
    expect(qk.companyReadiness('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'readiness'])
    expect(qk.companyHiring('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'hiring'])
    expect(qk.companyPnl('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'pnl'])
    expect(qk.companyCashflow('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'cashflow'])
    expect(qk.companyCredit('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'credit'])
    expect(qk.companyValuation('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'valuation'])
    expect(qk.companySensitivity('orgA', 'c1')).toEqual(['tenant', 'orgA', 'company', 'c1', 'sensitivity'])
  })

  it('prefix [tenant, orgA] matches the whole org subtree, [tenant, orgB] does not', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(qk.dashboard('orgA'), 'a-dashboard')
    queryClient.setQueryData(qk.company('orgA', 'c1'), 'a-company')
    queryClient.setQueryData(qk.companyPnl('orgA', 'c1'), 'a-pnl')
    queryClient.setQueryData(qk.companySensitivity('orgA', 'c2'), 'a-sensitivity')
    queryClient.setQueryData(qk.dashboard('orgB'), 'b-dashboard')
    queryClient.setQueryData(qk.companyPnl('orgB', 'c1'), 'b-pnl')

    const orgAKeys = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['tenant', 'orgA'] })
      .map((q) => q.queryKey)
    expect(sortKeys(orgAKeys)).toEqual(
      sortKeys([
        ['tenant', 'orgA', 'dashboard'],
        ['tenant', 'orgA', 'company', 'c1'],
        ['tenant', 'orgA', 'company', 'c1', 'pnl'],
        ['tenant', 'orgA', 'company', 'c2', 'sensitivity'],
      ]),
    )

    const orgBKeys = queryClient
      .getQueryCache()
      .findAll({ queryKey: ['tenant', 'orgB'] })
      .map((q) => q.queryKey)
    expect(sortKeys(orgBKeys)).toEqual(
      sortKeys([
        ['tenant', 'orgB', 'dashboard'],
        ['tenant', 'orgB', 'company', 'c1', 'pnl'],
      ]),
    )

    const companySubtree = queryClient
      .getQueryCache()
      .findAll({ queryKey: qk.company('orgA', 'c1') })
      .map((q) => q.queryKey)
    expect(sortKeys(companySubtree)).toEqual(
      sortKeys([
        ['tenant', 'orgA', 'company', 'c1'],
        ['tenant', 'orgA', 'company', 'c1', 'pnl'],
      ]),
    )
  })

  it('contains only JSON-serializable strings', () => {
    const all = [
      qk.dashboard('someUserId'),
      qk.company('t', 'c'),
      qk.companyMetrics('t', 'c'),
      qk.companyCohorts('t', 'c'),
      qk.companyBudgets('t', 'c'),
      qk.companyUnitEconomics('t', 'c'),
      qk.companyTasks('t', 'c'),
      qk.companyReadiness('t', 'c'),
      qk.companyHiring('t', 'c'),
      qk.companyPnl('t', 'c'),
      qk.companyCashflow('t', 'c'),
      qk.companyCredit('t', 'c'),
      qk.companyValuation('t', 'c'),
      qk.companySensitivity('t', 'c'),
    ]
    for (const key of all) {
      expect(key.every((segment) => typeof segment === 'string')).toBe(true)
      expect(JSON.parse(JSON.stringify(key))).toEqual(key)
    }
  })

  it('falls back to user id as tenant string when organization is null', () => {
    const key = qk.dashboard('someUserId')
    expect(key).toEqual(['tenant', 'someUserId', 'dashboard'])
    expect(key.every((segment) => typeof segment === 'string')).toBe(true)
  })

  it('normalizes set selections without mutating them for both endpoints', () => {
    const first: DashboardFilters = { companyIds: ['b', 'a', 'a'], industries: ['saas', 'fintech'],
      health: ['healthy', 'critical'], performanceStatus: ['on_track', 'behind'], periodTo: '2026-02-28' }
    const second: DashboardFilters = { periodTo: '2026-02-28', performanceStatus: ['behind', 'on_track'],
      health: ['critical', 'healthy'], industries: ['fintech', 'saas'], companyIds: ['a', 'b'] }
    expect(qk.dashboard('orgA', first)).toEqual(qk.dashboard('orgA', second))
    expect(qk.dashboardPerformance('orgA', 6, first)).toEqual(qk.dashboardPerformance('orgA', 6, second))
    expect(first.companyIds).toEqual(['b', 'a', 'a'])
    const key = qk.dashboardPerformance('orgA', 6, first)
    expect(key.every(segment => typeof segment === 'string')).toBe(true)
    expect(JSON.parse(JSON.stringify(key))).toEqual(key)
    expect(key).not.toEqual(qk.dashboardPerformance('orgB', 6, first))
  })

  it('keeps legacy keys for absent/empty filters and default six months', () => {
    expect(qk.dashboard('orgA', {})).toEqual(qk.dashboard('orgA'))
    expect(qk.dashboard('orgA', { companyIds: [], industries: [], health: [], performanceStatus: [] }))
      .toEqual(qk.dashboard('orgA'))
    expect(qk.dashboardPerformance('orgA')).toEqual(['tenant', 'orgA', 'dashboard', 'performance', '6'])
    expect(qk.dashboardPerformance('orgA', 6, {})).toEqual(qk.dashboardPerformance('orgA', 6))
  })

  it('distinguishes dates, explicit months, health and performance statuses', () => {
    const filters = { periodFrom: '2026-01-01', periodTo: '2026-02-28' }
    expect(qk.dashboardPerformance('orgA', undefined, filters)).not.toEqual(qk.dashboardPerformance('orgA', 6, filters))
    expect(qk.dashboardPerformance('orgA', 3, filters)).not.toEqual(qk.dashboardPerformance('orgA', 12, filters))
    expect(qk.dashboard('orgA', { health: ['no_data'] })).not.toEqual(qk.dashboard('orgA', { performanceStatus: ['no_data'] }))
    expect(qk.dashboard('orgA', filters)).not.toEqual(qk.dashboard('orgA', { ...filters, periodTo: '2026-03-31' }))
  })

  it('preserves tenant/dashboard invalidation across filtered keys', async () => {
    const client = new QueryClient()
    const keys = [qk.dashboard('orgA', { industries: ['saas'] }), qk.dashboardPerformance('orgA', 6, { health: ['healthy'] })]
    for (const key of keys) client.setQueryData(key, 'data')
    const other = qk.dashboard('orgB', { industries: ['saas'] })
    client.setQueryData(other, 'other')
    await client.invalidateQueries({ queryKey: qk.dashboard('orgA') })
    for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    expect(client.getQueryState(other)?.isInvalidated).toBe(false)
  })
})
