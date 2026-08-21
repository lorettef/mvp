import type { ValuationResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(1)}%`

const fmtX = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(2)}×`

interface ValuationTabProps {
  data?: ValuationResponse
  isLoading?: boolean
}

export function ValuationTab({ data, isLoading }: ValuationTabProps) {
  if (isLoading) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            Данные оценки бизнеса ещё не рассчитаны.
          </p>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    { label: 'Equity Value', value: fmtRub(data.equityValue) },
    { label: 'Terminal Value (TV)', value: fmtRub(data.terminalValue) },
    { label: 'P/S', value: fmtX(data.psRatio) },
    { label: 'На сотрудника', value: fmtRub(data.valuePerEmployee) },
  ]

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            Оценка бизнеса — модель Гордона
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {s.label}
                </p>
                <p className="text-xl font-bold mt-1 text-foreground">{s.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Параметры оценки</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              { label: 'Ключевая ставка', value: fmtPct(data.keyRate) },
              { label: 'Ставка дисконта (r = КС + 10%)', value: fmtPct(data.discountRate) },
              { label: 'Темп роста (g = инфляция)', value: fmtPct(data.growthRate) },
              { label: 'FCF', value: fmtRub(data.fcf) },
              { label: 'Чистый долг', value: fmtRub(data.netDebt) },
              { label: 'Годовая выручка', value: fmtRub(data.revenueAnnual) },
              { label: 'Штат', value: `${data.headcount} чел.` },
              { label: 'География', value: data.geography },
            ].map((row) => (
              <div key={row.label} className="flex justify-between border-b border-border/40 py-2">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-foreground">{row.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
