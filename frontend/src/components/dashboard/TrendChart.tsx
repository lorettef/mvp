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
import { fmtRub } from '@/lib/format'

export interface TrendPoint {
  month: string
  fact: number | null
  plan: number | null
}

interface TooltipEntry {
  dataKey?: string
  name?: string
  value?: number | string
  color?: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const rows = payload.filter((e) => e.dataKey === 'fact' || e.dataKey === 'plan')
  if (rows.length === 0) return null
  const fact = rows.find((e) => e.dataKey === 'fact')?.value
  const plan = rows.find((e) => e.dataKey === 'plan')?.value
  const f = typeof fact === 'number' ? fact : null
  const p = typeof plan === 'number' ? plan : null
  const delta = f != null && p != null ? f - p : null
  return (
    <div className="rounded-lg border bg-elevated px-3 py-2 shadow-lg">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-1">
        {rows.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}</span>
            <span className="ml-auto font-medium tabular-nums">
              {typeof entry.value === 'number' ? fmtRub(entry.value) : '—'}
            </span>
          </div>
        ))}
        {delta != null && (
          <div className="flex items-center gap-2 border-t border-border pt-1 text-sm">
            <span className="text-muted-foreground">Δ</span>
            <span
              className={`ml-auto font-medium tabular-nums ${
                delta >= 0 ? 'text-success' : 'text-destructive'
              }`}
            >
              {delta >= 0 ? '+' : ''}
              {Math.round(delta).toLocaleString('ru-RU')} ₽
            </span>
          </div>
        )}
      </div>
    </div>
  )
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
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'hsl(var(--border))' }} />
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
