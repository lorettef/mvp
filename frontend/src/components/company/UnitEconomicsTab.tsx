import type { UnitEconomicsResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`

const fmtNum = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : v.toFixed(digits)

const fmtMonths = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(1)} мес.`

interface UnitEconomicsTabProps {
  data?: UnitEconomicsResponse
  isLoading?: boolean
}

export function UnitEconomicsTab({ data, isLoading }: UnitEconomicsTabProps) {
  if (isLoading) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            Данные юнит-экономики ещё не рассчитаны.
          </p>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    {
      label: 'LTV/CAC',
      value: fmtNum(data.ltvCac),
      ok: data.ltvCac == null ? null : data.ltvCac >= 3,
    },
    {
      label: 'Magic Number',
      value: fmtNum(data.magicNumber),
      ok: data.magicNumber == null ? null : data.magicNumber >= 1,
    },
    {
      label: 'Runway',
      value: fmtMonths(data.runwayMonths),
      ok: data.runwayMonths == null ? null : data.runwayMonths >= 6,
    },
    {
      label: 'Churn',
      value: fmtPct(data.churn),
      ok: data.churn == null ? null : data.churn <= 0.05,
    },
  ]

  const retention = [
    { label: 'M1', value: data.retention.m1 },
    { label: 'M3', value: data.retention.m3 },
    { label: 'M6', value: data.retention.m6 },
    { label: 'M12', value: data.retention.m12 },
  ]

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-5">Юнит-экономика</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    s.ok === null
                      ? 'text-foreground'
                      : s.ok
                        ? 'text-emerald-500'
                        : 'text-destructive'
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Базовые метрики (факт)</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">MRR</dt>
                <dd className="text-foreground">{fmtRub(data.mrr)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">CAC</dt>
                <dd className="text-foreground">{fmtRub(data.cac)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">LTV</dt>
                <dd className="text-foreground">{fmtRub(data.ltv)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Churn</dt>
                <dd className="text-foreground">{fmtPct(data.churn)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Удержание (Retention, факт)</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {retention.map((r) => (
                <div key={r.label} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{r.label}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {fmtPct(r.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.alerts.length > 0 && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">Диагностика</h3>
            <ul className="space-y-2 text-sm">
              {data.alerts.map((a, i) => (
                <li key={i} className="text-foreground">
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
