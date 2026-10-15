import { useTranslation } from 'react-i18next'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CashFlowMonth, Cohort, Metric, PnLPeriod } from '@/types/api'
import { monthSeries } from '@/lib/kpi'
import { companyMetricTrend, companyCashPoints, companyEbitdaPoints } from '@/lib/companyOverview'
import { fmtPct, fmtRub, formatMonthLabel } from '@/lib/format'
import { ChartContainer } from '@/components/shared/chart-container'
import { TrendChart, type TrendPoint } from '@/components/dashboard/TrendChart'
import { CohortRetentionCell } from './CohortRetentionCell'

function EmptyChart() {
  const { t } = useTranslation()
  return <p className="py-12 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
}
const hasData = (data:Array<{first:number|null;second:number|null}>) => data.some(p => p.first !== null || p.second !== null)

export function CompanyTrendTooltip({ active,payload,label,percent }: {
  active?:boolean;payload?:Array<{name?:string;value?:number|string;color?:string}>;label?:string|number;percent:boolean
}) {
  const { i18n } = useTranslation()
  if (!active || !payload?.length) return null
  return <div className="max-w-64 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md [overflow-wrap:anywhere]">
    <p className="mb-2 font-medium">{formatMonthLabel(String(label),i18n.language)}</p>
    {payload.map(row=><p key={row.name} className="whitespace-normal" style={{color:row.color}}>{row.name}: {typeof row.value==='number'?(percent?fmtPct(row.value):fmtRub(row.value)):'—'}</p>)}
  </div>
}

function PairedChart({ data }: { data:TrendPoint[] }) {
  return data.some(p => p.fact !== null || p.plan !== null) ? <TrendChart data={data} height={288} showDots /> : <EmptyChart />
}
export function CompanyRevenueChart({ metrics }: { metrics:Metric[] }) { return <PairedChart data={monthSeries(metrics)} /> }
export function CompanyEbitdaChart({ periods }: { periods:PnLPeriod[] }) { return <PairedChart data={companyEbitdaPoints(periods)} /> }

/** Small two-series presentation; callers pass canonical values and labels. */
function CompanySeriesChart({ data,labels,percent=false,cash=false }: {
  data:Array<{month:string;first:number|null;second:number|null}>;labels:[string,string];percent?:boolean;cash?:boolean
}) {
  const { i18n } = useTranslation()
  if (!hasData(data)) return <EmptyChart />
  const money = new Intl.NumberFormat(i18n.language,{notation:'compact',maximumFractionDigits:1})
  return <ChartContainer height={288}>
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{top:8,right:12,bottom:4,left:0}} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{fontSize:11}} tickLine={false} />
        <YAxis width={66} tick={{fontSize:11}} tickLine={false} domain={percent?[0,1]:['auto','auto']}
          tickFormatter={(value:number) => percent ? `${Math.round(value*100)}%` : `₽${money.format(value)}`} />
        <Tooltip content={<CompanyTrendTooltip percent={percent} />} />
        <Legend iconSize={8} wrapperStyle={{fontSize:11,overflowWrap:'anywhere'}} />
        {cash ? <Bar dataKey="first" name={labels[0]} fill="hsl(var(--chart-2))" maxBarSize={28} isAnimationActive={false} />
          : <Line dataKey="first" name={labels[0]} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false} />}
        <Line dataKey="second" name={labels[1]} stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{r:3}} connectNulls={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  </ChartContainer>
}

export function CompanyUnitEconomicsTrendChart({ metrics }: { metrics:Metric[] }) {
  const { t } = useTranslation()
  const { type,data } = companyMetricTrend(metrics,['cac','ltv'])
  return <><p className="mb-2 text-xs text-muted-foreground">{t(`common.${type}`)}</p>
    <CompanySeriesChart data={data} labels={[t('company.profile.cac'),t('company.profile.ltv')]} /></>
}
export function CompanyRetentionTrendChart({ metrics }: { metrics:Metric[] }) {
  const { t } = useTranslation()
  const { type,data } = companyMetricTrend(metrics,['retentionRate','churn'])
  return <><p className="mb-2 text-xs text-muted-foreground">{t(`common.${type}`)}</p>
    <CompanySeriesChart data={data} labels={[t('company.profile.retention'),t('company.profile.churn')]} percent /></>
}
export function CompanyCashFlowChart({ months }: { months:CashFlowMonth[] }) {
  const { t } = useTranslation()
  return <CompanySeriesChart data={companyCashPoints(months)} labels={[t('company.profile.netCashFlow'),t('company.profile.balance')]} cash />
}
export function CompanyCohortChart({ cohorts }: { cohorts:Cohort[] }) {
  const { t,i18n } = useTranslation()
  if (!cohorts.length) return <EmptyChart />
  return <>
    <p className="mb-2 text-xs text-muted-foreground">{t('company.profile.cohortAge')}</p>
    <ChartContainer height={288} className="overflow-auto" tabIndex={0} role="group" aria-label={t('company.profile.charts.cohort')}>
      <table className="w-full min-w-[50rem] border-collapse text-xs" aria-label={t('company.profile.cohortTable')}>
        <thead><tr><th scope="col" className="p-2 text-left">{t('company.cohorts.cohort')}</th><th scope="col">{t('common.type')}</th>
          {Array.from({length:12},(_,i) => <th scope="col" key={i}>M{i+1}</th>)}
        </tr></thead>
        <tbody>{[...cohorts].sort((a,b) => a.period.localeCompare(b.period)||a.type.localeCompare(b.type)).map(c => <tr key={c.id} className="border-t">
          <th scope="row" className="whitespace-nowrap p-2 text-left font-normal">{formatMonthLabel(c.period.slice(0,7),i18n.language)}</th>
          <td className="p-2">{t(`common.${c.type}`)}</td>
          {Array.from({length:12},(_,i) => <td key={i} className="p-1 text-center"><CohortRetentionCell cohort={c} index={i} /></td>)}
        </tr>)}</tbody>
      </table>
    </ChartContainer>
  </>
}
