import type { AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { dashboardApi } from './companies'
import { api } from './client'
import type { DashboardFilters } from '@/types/api'

const originalAdapter = api.defaults.adapter
afterEach(() => { api.defaults.adapter = originalAdapter })

function capture(body: unknown = []) {
  const adapter = vi.fn(async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => ({
    data: body, status: 200, statusText: 'OK', headers: {}, config,
  }))
  api.defaults.adapter = adapter
  return adapter
}

const filters: DashboardFilters = {
  companyIds: ['b', 'a', 'a'], industries: ['saas', 'fintech'],
  health: ['healthy', 'critical'], performanceStatus: ['on_track', 'behind'],
  periodFrom: '2026-01-01', periodTo: '2026-02-28',
}

describe('dashboard filter wire contract', () => {
  it('camelizes industry profitability and preserves null margins and zero revenue', async () => {
    capture({ profitability_by_industry: [{ industry: null, revenue: 0, total_opex: 100,
      ebitda: -100, ebitda_margin: null, companies_total: 3, companies_included: 1 }] })
    const response = await dashboardApi.get()
    expect(response.profitabilityByIndustry).toEqual([{ industry: null, revenue: 0, totalOpex: 100,
      ebitda: -100, ebitdaMargin: null, companiesTotal: 3, companiesIncluded: 1 }])
  })
  it('preserves existing no-filter requests and AbortSignal', async () => {
    const adapter = capture()
    const controller = new AbortController()
    await dashboardApi.get({ signal: controller.signal })
    await dashboardApi.performance(6, { signal: controller.signal })
    await dashboardApi.performance()
    expect(adapter.mock.calls.map(([config]) => api.getUri(config))).toEqual([
      '/api/v1/dashboard', '/api/v1/dashboard/performance?months=6',
      '/api/v1/dashboard/performance?months=6',
    ])
    expect(adapter.mock.calls[0][0].signal).toBe(controller.signal)
    expect(adapter.mock.calls[1][0].signal).toBe(controller.signal)
  })

  it.each(['dashboard', 'performance'])('serializes repeated query names for %s without array brackets', async (endpoint) => {
    const adapter = capture()
    if (endpoint === 'dashboard') await dashboardApi.get({ filters })
    else await dashboardApi.performance(12, { filters })
    const url = new URL(api.getUri(adapter.mock.calls[0][0]), 'http://localhost')
    expect(url.searchParams.getAll('company_id')).toEqual(['a', 'b'])
    expect(url.searchParams.getAll('industry')).toEqual(['fintech', 'saas'])
    expect(url.searchParams.getAll('health')).toEqual(['critical', 'healthy'])
    expect(url.searchParams.getAll('performance_status')).toEqual(['behind', 'on_track'])
    expect(url.searchParams.get('period_from')).toBe('2026-01-01')
    expect(url.searchParams.get('period_to')).toBe('2026-02-28')
    expect(url.searchParams.get('months')).toBe(endpoint === 'performance' ? '12' : null)
    expect(url.search).not.toMatch(/%5B|%5D|\[|\]|companyIds|industries/u)
    expect(url.searchParams.has('status')).toBe(false)
    expect(filters.companyIds).toEqual(['b', 'a', 'a'])
  })

  it.each([{ periodFrom: '2026-01-01' }, { periodTo: '2026-02-28' }, filters])(
    'omits months for explicit dates without a selected cap', async (dateFilters) => {
      const adapter = capture()
      await dashboardApi.performance(undefined, { filters: dateFilters })
      const url = new URL(api.getUri(adapter.mock.calls[0][0]), 'http://localhost')
      expect(url.searchParams.has('months')).toBe(false)
    },
  )

  it('omits empty selections and still defaults to six without dates', async () => {
    const adapter = capture()
    await dashboardApi.performance(undefined, { filters: { companyIds: [], health: [], industries: [] } })
    expect(api.getUri(adapter.mock.calls[0][0])).toBe('/api/v1/dashboard/performance?months=6')
  })

  it('camelizes nested stored snapshots without replacing nulls or zeros', async () => {
    capture({ companies: [{ fact: { period: '2026-02-01', revenue: 0, new_units: 0,
      arpu: null, marketing_spend: 0, retention_rate: 1, churn: 0, ltv: 0, cac: 0 }, plan: null }] })
    const response = await dashboardApi.get()
    expect(response.companies[0].fact).toEqual({ period: '2026-02-01', revenue: 0,
      newUnits: 0, arpu: null, marketingSpend: 0, retentionRate: 1, churn: 0, ltv: 0, cac: 0 })
    expect(response.companies[0].plan).toBeNull()
  })
})
