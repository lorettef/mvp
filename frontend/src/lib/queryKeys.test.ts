import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { qk } from './queryKeys'

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
})
