import type { DashboardFilters } from '@/types/api'

/** Canonical set representation, shared by requests and tenant cache keys. */
export function normalizeDashboardFilters(filters: DashboardFilters = {}): DashboardFilters {
  const result: DashboardFilters = {}
  if (filters.companyIds?.length) result.companyIds = [...new Set(filters.companyIds)].sort()
  if (filters.industries?.length) result.industries = [...new Set(filters.industries)].sort()
  if (filters.health?.length) result.health = [...new Set(filters.health)].sort()
  if (filters.performanceStatus?.length) result.performanceStatus = [...new Set(filters.performanceStatus)].sort()
  if (filters.periodFrom) result.periodFrom = filters.periodFrom
  if (filters.periodTo) result.periodTo = filters.periodTo
  return result
}

export function dashboardFilterKey(filters?: DashboardFilters): string[] {
  const normalized = normalizeDashboardFilters(filters)
  return Object.keys(normalized).length ? [JSON.stringify(normalized)] : []
}

/** Omitted months means all periods for explicit dates, otherwise the legacy six. */
export function dashboardPerformanceMonths(months?: number, filters?: DashboardFilters): number | undefined {
  return months ?? (filters?.periodFrom || filters?.periodTo ? undefined : 6)
}

export function dashboardFilterParams(filters?: DashboardFilters): URLSearchParams {
  const normalized = normalizeDashboardFilters(filters)
  const params = new URLSearchParams()
  for (const value of normalized.companyIds ?? []) params.append('company_id', value)
  for (const value of normalized.industries ?? []) params.append('industry', value)
  for (const value of normalized.health ?? []) params.append('health', value)
  for (const value of normalized.performanceStatus ?? []) params.append('performance_status', value)
  if (normalized.periodFrom) params.set('period_from', normalized.periodFrom)
  if (normalized.periodTo) params.set('period_to', normalized.periodTo)
  return params
}
