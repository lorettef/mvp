import { fmtRub } from '@/lib/format'

interface TooltipEntry {
  dataKey?: string
  name?: string
  value?: number | string
  color?: string
}

export function RevenueChartTooltip({
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

