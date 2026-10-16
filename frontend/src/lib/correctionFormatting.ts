import { fmtPct, fmtRub } from './format'

const moneyKeys = new Set(['revenue', 'arpu', 'marketing_spend', 'cac', 'ltv'])
const rateKeys = new Set(['retention_rate', 'gross_margin', 'romi', 'churn', 'retention_m1', 'retention_m3', 'retention_m6', 'retention_m12'])
const monthKeys = new Set(['runway_months', 'payback_period'])

export function formatCorrectionValue(value: string | number | null | undefined, key: string, monthsLabel: (value: string) => string): string {
  if (value == null) return '—'
  const number = Number(value)
  if (!Number.isFinite(number)) return '—'
  if (moneyKeys.has(key)) return fmtRub(number)
  if (rateKeys.has(key)) return fmtPct(number)
  if (monthKeys.has(key)) return monthsLabel(number.toFixed(1))
  if (key === 'new_units') return number.toLocaleString()
  return number.toFixed(2)
}
