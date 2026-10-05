import type { CompanyStatusItem } from '@/types/api'

export interface CompanyRevenuePoint {
  id: string
  name: string
  period: string | null
  fact: number | null
  plan: number | null
}

export function companyRevenuePoints(companies: CompanyStatusItem[]): CompanyRevenuePoint[] {
  return companies.map(company => ({
    id: company.id,
    name: company.name,
    period: company.fact?.period ?? null,
    fact: company.fact?.revenue ?? null,
    plan: company.plan?.revenue ?? null,
  }))
}

// Retain each company's palette slot for this browser session, including when
// global filters remove/reintroduce it. First-seen companies use distinct slots;
// larger portfolios cycle through the existing five design tokens.
const companyPaletteSlots = new Map<string, number>()
export function companyRevenueColor(id: string): string {
  let slot = companyPaletteSlots.get(id)
  if (slot === undefined) {
    slot = companyPaletteSlots.size % 5 + 1
    companyPaletteSlots.set(id, slot)
  }
  return `hsl(var(--chart-${slot}))`
}

export function companyRevenueShares(companies: CompanyStatusItem[]) {
  const contributors = companyRevenuePoints(companies).filter(
    (point): point is CompanyRevenuePoint & { fact: number } => point.fact !== null,
  )
  const total = contributors.reduce((sum, point) => sum + point.fact, 0)
  const data = contributors.map(point => ({
    ...point,
    revenue: point.fact,
    share: total === 0 ? 0 : point.fact / total,
    color: companyRevenueColor(point.id),
  }))
  return { data, total }
}
