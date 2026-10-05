import { useTranslation } from 'react-i18next'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RevenueChartTooltip } from './RevenueChartTooltip'

export interface TrendPoint {
  month: string
  fact: number | null
  plan: number | null
}

export function TrendChart({
  data,
  lines = ['fact', 'plan'],
  height = 288,
}: {
  data: TrendPoint[]
  lines?: ('fact' | 'plan')[]
  height?: number
}) {
  const { t } = useTranslation()
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <YAxis
            tickFormatter={(v: number) => `₽${(v / 1000).toFixed(0)}k`}
            tickLine={false}
            axisLine={false}
            width={64}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          />
          <Tooltip content={<RevenueChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {lines.includes('fact') && (
            <Line
              type="monotone"
              dataKey="fact"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              name={t('common.fact')}
              connectNulls
              dot={false}
            />
          )}
          {lines.includes('plan') && (
            <Line
              type="monotone"
              dataKey="plan"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              strokeDasharray="5 5"
              name={t('common.plan')}
              connectNulls
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
