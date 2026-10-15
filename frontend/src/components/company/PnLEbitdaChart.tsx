import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PnLPeriod } from '@/types/api'
import { ChartContainer } from '@/components/shared/chart-container'
import { companyEbitdaPoints } from '@/lib/companyOverview'
import { CompanyTrendTooltip } from './CompanyProfileCharts'

/** Paired server EBITDA only; no legacy mixed months or recomputation. */
export function PnLEbitdaChart({ periods }: { periods: PnLPeriod[] }) {
  const { t, i18n } = useTranslation()
  const data = companyEbitdaPoints(periods)
  const money = new Intl.NumberFormat(i18n.language, { notation: 'compact', maximumFractionDigits: 1 })
  if (!data.some(p => p.plan !== null || p.fact !== null)) return <p className="py-8 text-center text-sm text-muted-foreground">{t('common.noData')}</p>
  return <ChartContainer height={288}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 0 }} barGap={4} maxBarSize={32} accessibilityLayer>
        <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis width={72} tick={{ fontSize: 11 }} tickLine={false} tickFormatter={(v: number) => `₽${money.format(v)}`} />
        <Tooltip content={<CompanyTrendTooltip percent={false} />} />
        <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="plan" name={t('company.sourceActions.planEbitda')} fill="hsl(var(--chart-2))" isAnimationActive={false} />
        <Bar dataKey="fact" name={t('company.sourceActions.factEbitda')} fill="hsl(var(--chart-1))" isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </ChartContainer>
}
