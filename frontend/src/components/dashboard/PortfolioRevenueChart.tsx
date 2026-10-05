import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Legend,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RevenueChartTooltip } from './RevenueChartTooltip'
import type { PerformancePoint } from '@/types/api'

export function PortfolioRevenueChart({
  data,
  series = ['fact', 'plan'],
  height = 256,
}: {
  data: PerformancePoint[]
  series?: ('fact' | 'plan')[]
  height?: number
}) {
  const { t, i18n } = useTranslation()
  const axisNumber = new Intl.NumberFormat(i18n.resolvedLanguage ?? 'ru', { notation: 'compact', maximumFractionDigits: 1 })
  if (!data.some((point) => series.some((key) => point[key] != null))) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t(data.length === 0 ? 'overview.performance.empty' : 'dashboard.performance.noSeriesData')}
      </p>
    )
  }

  return (
    <div className="min-w-0" role="region" aria-label={t('dashboard.performance.chartLabel')} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={6} maxBarSize={36} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.7} vertical={false} />
          <XAxis
            dataKey="month"
            interval="preserveStartEnd"
            minTickGap={16}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <YAxis
            tickFormatter={(v: number) => `₽${axisNumber.format(v)}`}
            tickLine={false}
            axisLine={false}
            width={72}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
          />
          <Tooltip content={<RevenueChartTooltip />} cursor={{ fill: 'hsl(var(--muted))', fillOpacity: 0.5 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {series.includes('fact') && (
            <Bar
              dataKey="fact"
              fill="hsl(var(--chart-1))"
              name={t('common.fact')}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          )}
          {series.includes('plan') && (
            <Bar
              dataKey="plan"
              fill="hsl(var(--chart-2))"
              name={t('common.plan')}
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
