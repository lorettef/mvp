import type { CompanyStatusItem } from '@/types/api'

const statuses = ['on_track','behind','no_plan','no_data'] as const
export function performanceCounts(companies: CompanyStatusItem[]) {
  return statuses.map(status => ({ status, count:companies.filter(company => company.status === status).length }))
}
export function runwayCompanies(companies: CompanyStatusItem[]) {
  return companies.filter(c => c.runwayMonths != null && Number.isFinite(c.runwayMonths))
    .sort((a,b) => a.runwayMonths! - b.runwayMonths! || a.name.localeCompare(b.name))
}
