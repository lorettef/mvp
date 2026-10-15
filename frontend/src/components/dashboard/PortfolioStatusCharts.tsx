import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CompanyStatusItem } from '@/types/api'
import { ChartContainer } from '@/components/shared/chart-container'
import { performanceCounts, runwayCompanies } from '@/lib/portfolioStatus'

export function PortfolioPerformanceStatusChart({ companies }: { companies:CompanyStatusItem[] }) {
  const { t } = useTranslation()
  if (!companies.length) return <p className="py-12 text-center text-sm text-muted-foreground">{t('dashboard.analytics.empty')}</p>
  const data = performanceCounts(companies).map(point => ({ ...point,label:t(`dashboard.analytics.statuses.${point.status}`) }))
  return <>
    <ChartContainer height={288}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{left:0,right:20,top:8,bottom:8}} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis type="number" allowDecimals={false} tick={{fontSize:11}} />
          <YAxis type="category" dataKey="label" width={130} tick={{fontSize:11}} tickLine={false} />
          <Tooltip cursor={{fill:'hsl(var(--muted))'}} />
          <Bar dataKey="count" name={t('dashboard.cards.companies')} maxBarSize={28} isAnimationActive={false}>
            {data.map((point,i) => <Cell key={point.status} fill={`hsl(var(--chart-${i+1}))`} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
    <ul className="sr-only" aria-label={t('dashboard.analytics.status')}>
      {data.map(p => <li key={p.status}>{p.label}: {p.count}</li>)}
    </ul>
  </>
}

export function PortfolioRunwayChart({ companies }: { companies:CompanyStatusItem[] }) {
  const { t } = useTranslation()
  const data = runwayCompanies(companies)
  const missing = companies.length - data.length
  return <>
    {missing > 0 && <p className="mb-2 text-xs text-muted-foreground">{t('dashboard.analytics.runwayMissing',{count:missing})}</p>}
    {!data.length ? <p className="py-12 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
      : <div className="max-h-80 min-w-0 w-full overflow-y-auto" tabIndex={data.length > 7 ? 0 : undefined} role="group" aria-label={t('dashboard.analytics.runway')}>
        <ChartContainer height={Math.max(256,data.length*36+40)}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{left:0,right:20,top:8,bottom:8}} accessibilityLayer>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
              <XAxis type="number" tick={{fontSize:11}} />
              <YAxis type="category" dataKey="name" width={110} interval={0} tickLine={false} tick={{fontSize:11}}
                tickFormatter={(name:string) => name.length > 16 ? `${name.slice(0,15)}…` : name} />
              <Tooltip formatter={(value:number) => t('overview.kpi.runwayMonths',{value})} />
              <Bar dataKey="runwayMonths" name={t('dashboard.analytics.months')} fill="hsl(var(--chart-2))" maxBarSize={24} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </ChartContainer>
      </div>}
    <ul className="sr-only" aria-label={t('dashboard.analytics.runwayValues')}>
      {data.map(c => <li key={c.id}>{c.name}: {t('overview.kpi.runwayMonths',{value:c.runwayMonths})}</li>)}
      {companies.filter(c => !data.some(row => row.id === c.id)).map(c => <li key={c.id}>{c.name}: {t('common.noData')}</li>)}
    </ul>
  </>
}
