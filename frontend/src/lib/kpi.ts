import type { CatalogResponse, Company, Metric } from '@/types/api'

export interface KpiSpec {
  key: string
  label: string
}

const FALLBACK_KEYS = ['revenue', 'arpu', 'new_units', 'retention_rate', 'cac']

// Catalog metric keys (snake_case, from metric_catalog) → Metric field (camelCase).
const FIELD_MAP: Record<string, string> = {
  new_units: 'newUnits',
  arpu: 'arpu',
  revenue: 'revenue',
  marketing_spend: 'marketingSpend',
  retention_rate: 'retentionRate',
  churn: 'churn',
  ltv: 'ltv',
  cac: 'cac',
}

function fieldOf(key: string): string {
  return FIELD_MAP[key] ?? key
}

/**
 * Выбор headline-KPI стартапа: метрики профиля (industry → business model)
 * из каталога, отфильтрованные по selected_metrics компании, в порядке
 * каталога; фолбэк — общий набор. Метрики берутся из существующего
 * metric_catalog (через /catalog), отдельного словаря не создаём.
 */
export function selectKpiSpecs(
  company: Company,
  catalog: CatalogResponse | undefined,
): KpiSpec[] {
  const profile =
    catalog && company.industry && company.businessModel
      ? catalog.profiles[company.industry]?.[company.businessModel]
      : undefined
  const defs = profile?.metrics ?? []
  const selected = company.selectedMetrics ?? []

  let specs: KpiSpec[] = defs.map((m) => ({ key: m.key, label: m.label }))
  if (specs.length === 0) {
    specs = FALLBACK_KEYS.map((k) => ({ key: k, label: k }))
  }
  if (selected.length > 0) {
    const wanted = new Set(selected)
    specs = specs.filter((s) => wanted.has(s.key))
  }
  if (specs.length === 0) {
    specs = FALLBACK_KEYS.map((k) => ({ key: k, label: k }))
  }
  return specs.slice(0, 5)
}

export function latestFact(metrics: Metric[]): Metric | null {
  const facts = metrics
    .filter((m) => m.type === 'fact')
    .sort((a, b) => b.period.localeCompare(a.period))
  return facts[0] ?? null
}

export function latestPlan(metrics: Metric[]): Metric | null {
  const plans = metrics
    .filter((m) => m.type === 'plan')
    .sort((a, b) => b.period.localeCompare(a.period))
  return plans[0] ?? null
}

export function planForPeriod(metrics: Metric[], period: string | undefined): Metric | null {
  if (!period) return null
  return metrics.find((m) => m.type === 'plan' && m.period === period) ?? null
}

export function factSeries(metrics: Metric[], key: string): number[] {
  const field = fieldOf(key)
  return metrics
    .filter((m) => m.type === 'fact')
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((m) => {
      const v = (m as unknown as Record<string, unknown>)[field]
      return typeof v === 'number' && Number.isFinite(v) ? v : NaN
    })
    .filter((v) => Number.isFinite(v))
}

export function metricNumber(metric: Metric | null, key: string): number | null {
  if (!metric) return null
  const v = (metric as unknown as Record<string, unknown>)[fieldOf(key)]
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function relativeDeltaPct(series: number[]): number | null {
  if (series.length < 2) return null
  const prev = series[series.length - 2]
  const last = series[series.length - 1]
  if (!prev) return null
  return Math.round(((last - prev) / prev) * 1000) / 10
}

export function monthSeries(metrics: Metric[]): { month: string; fact: number | null; plan: number | null }[] {
  const byPeriod = new Map<string, { fact?: number; plan?: number }>()
  for (const m of metrics) {
    const month = m.period.slice(0, 7)
    const entry = byPeriod.get(month) ?? {}
    if (m.type === 'fact') entry.fact = m.revenue
    else entry.plan = m.revenue
    byPeriod.set(month, entry)
  }
  return Array.from(byPeriod.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, e]) => ({ month, fact: e.fact ?? null, plan: e.plan ?? null }))
}
