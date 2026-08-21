import type { CreditForecastResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'

const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(1)}%`

const fmtPeriod = (period: string) => (period ? period.slice(0, 7) : '—')

interface CreditTabProps {
  data?: CreditForecastResponse
  isLoading?: boolean
}

export function CreditTab({ data, isLoading }: CreditTabProps) {
  if (isLoading) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-64 mb-4" />
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            Данные прогнозирования кредитов ещё не рассчитаны.
          </p>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    { label: 'Ключевая ставка', value: fmtPct(data.keyRate) },
    { label: 'Ставка кредита (КС + 5%)', value: fmtPct(data.creditRate) },
    { label: 'Стартовый кэш', value: fmtRub(data.openingCash) },
    {
      label: 'Требуется кредит',
      value: fmtRub(data.totalCreditNeeded),
      accent: data.gaps.length > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            Кредиты — умное прогнозирование
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    s.accent ? 'text-destructive' : 'text-foreground'
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.gaps.length > 0 && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">
              Кассовые разрывы
            </h3>
            <div className="space-y-3">
              {data.gaps.map((g) => (
                <div
                  key={g.month}
                  className="flex items-center justify-between rounded-lg border border-border p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {fmtPeriod(g.period)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Разрыв {fmtRub(g.gap)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      Кредит {fmtRub(g.creditAmount)}
                    </p>
                    <Badge variant="outline">{fmtPct(g.rate)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            Прогноз по месяцам
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left font-medium px-4 py-3">Месяц</th>
                  <th className="text-left font-medium px-4 py-3">Период</th>
                  <th className="text-left font-medium px-4 py-3">Выручка</th>
                  <th className="text-left font-medium px-4 py-3">OPEX</th>
                  <th className="text-left font-medium px-4 py-3">Net CF</th>
                  <th className="text-left font-medium px-4 py-3">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {data.months.map((m) => (
                  <tr
                    key={m.month}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{m.month}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {fmtPeriod(m.period)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(m.revenue)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(m.opex)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(m.netCf)}
                    </td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        m.balanceAfter < 0 ? 'text-destructive' : 'text-foreground'
                      }`}
                    >
                      {fmtRub(m.balanceAfter)}
                    </td>
                  </tr>
                ))}
                {data.months.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      Добавьте метрики MRR, чтобы построить прогноз.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
