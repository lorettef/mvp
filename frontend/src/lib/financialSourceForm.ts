import type { BudgetSource, BudgetUpsert, MetricUpsert, UnitEconomicsMetricSource } from '@/types/api'

export type MetricInputField = 'new_units' | 'arpu' | 'revenue' | 'marketing_spend' | 'retention_rate'
export const budgetInputFields = ['cogs', 'marketing', 'development', 'fot', 'gna'] as const
export type BudgetInputField = typeof budgetInputFields[number]

/** UI retention is a percentage; API retention is a fraction. */
export function metricInputValues(source: UnitEconomicsMetricSource): Record<MetricInputField, string> {
  return {
    new_units: source.newUnits == null ? '' : String(source.newUnits),
    arpu: source.arpu == null ? '' : String(source.arpu),
    revenue: source.revenue == null ? '' : String(source.revenue),
    marketing_spend: source.marketingSpend == null ? '' : String(source.marketingSpend),
    retention_rate: source.retentionRate == null ? '' : String(source.retentionRate * 100),
  }
}

export function numericInputError(raw: string, field?: MetricInputField): string | undefined {
  if (!raw.trim()) return 'company.unit.required'
  const value = Number(raw)
  if (field === 'new_units' && (!Number.isSafeInteger(value) || value < 0)) return 'company.unit.integer'
  if (field === 'arpu' && (!Number.isFinite(value) || value <= 0)) return 'company.unit.positive'
  if (field === 'retention_rate' && (!Number.isFinite(value) || value < 0 || value > 100)) return 'company.unit.retentionRange'
  if (!Number.isFinite(value) || value < 0) return 'company.unit.nonnegative'
}

export const retentionFromInput = (raw: string): number => Number(raw) / 100

/** Copy the complete stored source, changing only one field. Never copy derived values. */
export function metricSourceUpdate(source: UnitEconomicsMetricSource, field: MetricInputField, raw: string): MetricUpsert {
  if (source.arpu == null && field !== 'arpu') throw new Error('Incomplete metric source')
  return {
    period: source.period, type: source.type,
    new_units: source.newUnits, arpu: field === 'arpu' ? Number(raw) : source.arpu!, revenue: source.revenue,
    marketing_spend: source.marketingSpend, retention_rate: source.retentionRate,
    comment: source.comment,
    [field]: field === 'retention_rate' ? retentionFromInput(raw) : Number(raw),
  }
}

export function budgetSourceUpdate(source: BudgetSource, field: BudgetInputField, raw: string): BudgetUpsert {
  return {
    period: source.period, type: source.type,
    ...(source.cogs !== undefined ? { cogs: source.cogs } : {}),
    marketing: source.marketing, development: source.development, fot: source.fot, gna: source.gna,
    [field]: Number(raw),
  }
}
