import type { BudgetUpsert, CohortUpsert, MetricUpsert } from '@/types/api'
import { budgetInputFields, numericInputError, retentionFromInput, type BudgetInputField, type MetricInputField } from './financialSourceForm'

export type EntryScenario = '' | 'plan' | 'fact'
export interface EntryIdentity { period: string; type: EntryScenario }
export interface MetricEntryRow extends EntryIdentity {
  id: number
  values: Record<MetricInputField, string>
  comment: string
}
export interface BudgetEntryRow extends EntryIdentity {
  id: number
  values: Record<BudgetInputField, string>
  saved: boolean
}
export interface CohortEntry extends EntryIdentity { size: string; retention: string[]; marketing: string }
export type EntryErrors = Partial<Record<string, string>>

export function validEntryMonth(period: string): boolean {
  return /^[0-9]{4}-(0[1-9]|1[0-2])$/.test(period) && Number(period.slice(0, 4)) > 0
}
export function nextEntryMonth(period: string): string {
  if (!validEntryMonth(period)) return ''
  const [year, month] = period.split('-').map(Number)
  const next = `${String(year + (month === 12 ? 1 : 0)).padStart(4, '0')}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`
  return validEntryMonth(next) ? next : ''
}
export function currentEntryMonth(): string {
  const now = new Date()
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}`
}
export const emptyMetricEntry = (id: number, period: string, type: EntryScenario = ''): MetricEntryRow => ({
  id, period, type, values: { new_units:'', arpu:'', revenue:'', marketing_spend:'', retention_rate:'' }, comment:'',
})
export const emptyBudgetEntry = (id: number, period: string, type: EntryScenario = ''): BudgetEntryRow => ({
  id, period, type, values: { cogs:'', marketing:'' , development:'', fot:'', gna:'' }, saved:false,
})

function identityErrors(row: EntryIdentity): EntryErrors {
  return {
    ...(!validEntryMonth(row.period) ? { period:'company.unit.required' } : {}),
    ...(row.type !== 'plan' && row.type !== 'fact' ? { type:'company.unit.required' } : {}),
  }
}
export function metricEntryErrors(row: MetricEntryRow): EntryErrors {
  const errors = identityErrors(row)
  for (const field of Object.keys(row.values) as MetricInputField[]) {
    const error = numericInputError(row.values[field], field)
    if (error) errors[field] = error
  }
  return errors
}
export function budgetEntryErrors(row: BudgetEntryRow): EntryErrors {
  const errors = identityErrors(row)
  for (const field of budgetInputFields) {
    const error = numericInputError(row.values[field])
    if (error) errors[field] = error
  }
  return errors
}
export function cohortEntryErrors(row: CohortEntry): EntryErrors {
  const errors = identityErrors(row)
  if (!row.size.trim()) errors.size = 'company.unit.required'
  else if (!Number.isSafeInteger(Number(row.size)) || Number(row.size) < 1) errors.size = 'company.wizard.cohortSize'
  row.retention.forEach((raw, index) => {
    if (raw.trim()) {
      const error = numericInputError(raw, 'retention_rate')
      if (error) errors[`retention-${index + 1}`] = error
    }
  })
  if (row.marketing.trim()) {
    const error = numericInputError(row.marketing)
    if (error) errors.marketing = error
  }
  return errors
}
export function duplicateEntryIds(rows: Array<EntryIdentity & { id: number }>): Set<number> {
  const identities = new Map<string, number[]>()
  for (const row of rows) {
    const key = `${row.period}:${row.type}`
    identities.set(key, [...(identities.get(key) ?? []), row.id])
  }
  return new Set([...identities.values()].filter((ids) => ids.length > 1).flat())
}

export function metricEntryPayload(row: MetricEntryRow): MetricUpsert {
  if (Object.keys(metricEntryErrors(row)).length) throw new Error('Invalid metric draft')
  return {
    period:`${row.period}-01`, type:row.type as 'plan' | 'fact',
    new_units:Number(row.values.new_units), arpu:Number(row.values.arpu), revenue:Number(row.values.revenue),
    marketing_spend:Number(row.values.marketing_spend), retention_rate:retentionFromInput(row.values.retention_rate),
    comment:row.comment || null,
  }
}
export function budgetEntryPayload(row: BudgetEntryRow): BudgetUpsert {
  if (Object.keys(budgetEntryErrors(row)).length) throw new Error('Invalid budget draft')
  return { period:`${row.period}-01`,type:row.type as 'plan' | 'fact',cogs:Number(row.values.cogs),marketing:Number(row.values.marketing),development:Number(row.values.development),fot:Number(row.values.fot),gna:Number(row.values.gna) }
}
export function cohortEntryPayload(row: CohortEntry): CohortUpsert {
  if (Object.keys(cohortEntryErrors(row)).length) throw new Error('Invalid cohort draft')
  const retention = row.retention.map((raw) => raw.trim() ? retentionFromInput(raw) : null)
  return {
    period:`${row.period}-01`,type:row.type as 'plan' | 'fact',size:Number(row.size),
    retention_m1:retention[0],retention_m2:retention[1],retention_m3:retention[2],retention_m4:retention[3],
    retention_m5:retention[4],retention_m6:retention[5],retention_m7:retention[6],retention_m8:retention[7],
    retention_m9:retention[8],retention_m10:retention[9],retention_m11:retention[10],retention_m12:retention[11],
    ...(row.marketing.trim() ? { marketing_spend:Number(row.marketing) } : {}),
  }
}
