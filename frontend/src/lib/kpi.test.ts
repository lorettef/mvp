import { describe, expect, it } from 'vitest'
import type { CatalogResponse, Company, Metric } from '@/types/api'
import {
  factSeries,
  latestFact,
  latestPlan,
  metricNumber,
  monthSeries,
  planForPeriod,
  relativeDeltaPct,
  selectKpiSpecs,
} from './kpi'

const company = (over: Partial<Company> = {}): Company => ({
  id: 'c1',
  organizationId: 'o1',
  name: 'Test',
  industry: 'saas',
  businessModel: 'subscription',
  geography: 'RU',
  grossMargin: 0.75,
  selectedMetrics: null,
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
})

const catalog: CatalogResponse = {
  industries: [{ slug: 'saas', label: 'SaaS' }],
  business_models: [{ slug: 'subscription', label: 'Подписка', description: '' }],
  profiles: {
    saas: {
      subscription: {
        label: '',
        why: '',
        derived: ['churn', 'ltv', 'cac'],
        metrics: [
          { key: 'new_units', label: 'Новые клиенты', required: true, why: '' },
          { key: 'arpu', label: 'ARPU', required: true, why: '' },
          { key: 'revenue', label: 'Выручка', required: true, why: '' },
          { key: 'marketing_spend', label: 'Маркетинг', required: true, why: '' },
          { key: 'retention_rate', label: 'Удержание', required: true, why: '' },
        ],
      },
    },
  },
}

const metric = (period: string, type: 'plan' | 'fact', revenue: number): Metric => ({
  id: `${type}-${period}`,
  companyId: 'c1',
  period,
  type,
  newUnits: 10,
  arpu: 100,
  revenue,
  marketingSpend: 500,
  retentionRate: 0.9,
  churn: 0.1,
  ltv: 900,
  cac: 50,
  activeUnits: null,
  comment: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

describe('selectKpiSpecs', () => {
  it('returns catalog profile metrics in order for a profiled company', () => {
    const specs = selectKpiSpecs(company(), catalog)
    expect(specs.map((s) => s.key)).toEqual(['new_units', 'arpu', 'revenue', 'marketing_spend', 'retention_rate'])
  })

  it('filters to selected metrics when the company has chosen a subset', () => {
    const specs = selectKpiSpecs(company({ selectedMetrics: ['revenue', 'retention_rate'] }), catalog)
    expect(specs.map((s) => s.key)).toEqual(['revenue', 'retention_rate'])
  })

  it('falls back to common metrics when no profile exists', () => {
    const specs = selectKpiSpecs(company({ industry: null, businessModel: null }), catalog)
    expect(specs.map((s) => s.key)).toEqual(['revenue', 'arpu', 'new_units', 'retention_rate', 'cac'])
  })
})

describe('series helpers', () => {
  const metrics = [
    metric('2026-01-01', 'fact', 1000),
    metric('2026-02-01', 'fact', 1200),
    metric('2026-03-01', 'fact', 1400),
    metric('2026-02-01', 'plan', 1300),
  ]

  it('extracts the latest fact and plan rows', () => {
    expect(latestFact(metrics)?.revenue).toBe(1400)
    expect(latestPlan(metrics)?.revenue).toBe(1300)
  })

  it('finds a plan for the exact fact period (PF-1 alignment)', () => {
    expect(planForPeriod(metrics, '2026-02-01')?.revenue).toBe(1300)
    expect(planForPeriod(metrics, '2026-03-01')).toBeNull()
    expect(planForPeriod(metrics, undefined)).toBeNull()
  })

  it('builds an ascending fact series for a metric key', () => {
    expect(factSeries(metrics, 'revenue')).toEqual([1000, 1200, 1400])
  })

  it('reads a numeric metric value with null fallback', () => {
    expect(metricNumber(latestFact(metrics), 'revenue')).toBe(1400)
    expect(metricNumber(latestFact(metrics), 'active_units')).toBeNull()
  })

  it('maps snake_case catalog keys to camelCase Metric fields', () => {
    expect(metricNumber(latestFact(metrics), 'new_units')).toBe(10)
    expect(metricNumber(latestFact(metrics), 'marketing_spend')).toBe(500)
    expect(metricNumber(latestFact(metrics), 'retention_rate')).toBe(0.9)
  })

  it('computes a relative percentage delta rounded to one decimal', () => {
    expect(relativeDeltaPct([1000, 1200, 1400])).toBe(16.7)
    expect(relativeDeltaPct([1000])).toBeNull()
  })

  it('builds month series with nulls for missing fact/plan', () => {
    const series = monthSeries(metrics)
    expect(series).toEqual([
      { month: '2026-01', fact: 1000, plan: null },
      { month: '2026-02', fact: 1200, plan: 1300 },
      { month: '2026-03', fact: 1400, plan: null },
    ])
  })
})
