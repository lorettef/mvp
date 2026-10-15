import { describe, expect, it } from 'vitest'
import type { UnitEconomicsMetricSource } from '@/types/api'
import { budgetSourceUpdate, metricInputValues, metricSourceUpdate, numericInputError } from './financialSourceForm'

const metric: UnitEconomicsMetricSource = { id: 'm', period: '2026-02-01', type: 'fact', newUnits: 7, arpu: 1234.56, revenue: 100000, marketingSpend: 123.45, retentionRate: 0.973456789, comment: null }
describe('financial source inputs', () => {
  it.each([['', 'revenue'], ['Infinity', 'revenue'], ['-1', 'revenue'], ['1.5', 'new_units'], ['0', 'arpu'], ['101', 'retention_rate']] as const)('rejects %s for %s', (raw, field) => {
    expect(numericInputError(raw, field)).toBeTruthy()
  })
  it('allows stored zero and money decimals but requires positive ARPU', () => {
    expect(numericInputError('0', 'revenue')).toBeUndefined()
    expect(numericInputError('10.25')).toBeUndefined()
    expect(numericInputError('100', 'retention_rate')).toBeUndefined()
  })
  it('preserves exact untouched source fields including fractional retention and null comment', () => {
    expect(metricSourceUpdate(metric, 'revenue', '200.25')).toEqual({ period:metric.period, type:'fact',new_units:7,arpu:1234.56,revenue:200.25,marketing_spend:123.45,retention_rate:metric.retentionRate,comment:null })
    expect(metricSourceUpdate(metric, 'retention_rate', '85').retention_rate).toBe(0.85)
    expect(metricInputValues(metric).retention_rate).toBe(String(metric.retentionRate * 100))
    expect(metricInputValues({ ...metric, arpu:null }).arpu).toBe('')
  })
  it('keeps complete Budget identity and sibling values', () => {
    expect(budgetSourceUpdate({ id:'b',period:metric.period,type:'plan',marketing:1,development:2,fot:3,gna:4 },'fot','0')).toEqual({ period:metric.period,type:'plan',marketing:1,development:2,fot:0,gna:4 })
  })
})
