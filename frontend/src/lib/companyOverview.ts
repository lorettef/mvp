import type { CashFlowMonth, Cohort, Metric, PnLPeriod } from '@/types/api'
import { latestFact, latestPlan, metricNumber, planForPeriod, relativeDeltaPct } from './kpi'

/** Display adapters over server snapshots, never a second financial engine. */
export function companyMetricOverview(metrics: Metric[]) {
  const fact = latestFact(metrics)
  const current = fact ?? latestPlan(metrics)
  const previous = current ? metrics.filter(m => m.type === current.type && m.period < current.period)
    .sort((a,b) => b.period.localeCompare(a.period))[0] : undefined
  const revenue = metricNumber(current, 'revenue')
  const previousRevenue = metricNumber(previous ?? null, 'revenue')
  const growth = revenue !== null && previousRevenue !== null
    ? relativeDeltaPct([previousRevenue, revenue]) : null
  const plan = planForPeriod(metrics, fact?.period)
  const planRevenue = metricNumber(plan, 'revenue')
  const status = !fact || revenue === null ? 'no_data'
    : planRevenue === null ? 'no_plan' : revenue >= planRevenue ? 'on_track' : 'behind'
  return { current, previous, revenue, growth, status } as const
}

export function companyMarginSource(periods: PnLPeriod[]) {
  const ordered = [...periods].sort((a,b) => b.period.localeCompare(a.period))
  for (const type of ['fact','plan'] as const) {
    const source = ordered.find(p => p[type] != null)
    const value = source?.[type]?.ebitdaMargin
    if (source && value != null && Number.isFinite(value)) return { period:source.period, type, value }
  }
  return null
}

/** Fact first, explicitly labelled Plan fallback, without mixing scenarios in a trend. */
export function companyMetricTrend(metrics: Metric[], fields: [keyof Pick<Metric,'cac'|'ltv'|'retentionRate'|'churn'>,keyof Pick<Metric,'cac'|'ltv'|'retentionRate'|'churn'>]) {
  const type = metrics.some(m => m.type === 'fact') ? 'fact' : 'plan'
  const data = metrics.filter(m => m.type === type).sort((a,b) => a.period.localeCompare(b.period))
    .map(m => ({ month:m.period.slice(0,7), first:metricNumber(m, fields[0]), second:metricNumber(m, fields[1]) }))
  return { type, data }
}

export const companyEbitdaPoints = (periods:PnLPeriod[]) => [...periods].sort((a,b) => a.period.localeCompare(b.period))
  .map(p => ({ month:p.period.slice(0,7),fact:p.fact?.ebitda??null,plan:p.plan?.ebitda??null }))
export const companyCashPoints = (months:CashFlowMonth[]) => [...months].sort((a,b) => a.period.localeCompare(b.period))
  .map(m => ({ month:m.period.slice(0,7),first:m.netCashFlow??null,second:m.closingBalance??null }))

const retentionKeys = ['retentionM1','retentionM2','retentionM3','retentionM4','retentionM5','retentionM6',
  'retentionM7','retentionM8','retentionM9','retentionM10','retentionM11','retentionM12'] as const
export const retentionAt = (cohort:Cohort,index:number):number|null => cohort[retentionKeys[index]] ?? null
