import type { PnLResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`

const fmtPeriod = (period: string | null) => (period ? period.slice(0, 7) : '—')

interface PnLTabProps {
  data?: PnLResponse
  isLoading?: boolean
}

interface RowProps {
  label: string
  value: string
  bold?: boolean
  accent?: 'positive' | 'negative'
}

function Row({ label, value, bold, accent }: RowProps) {
  const valueClass =
    accent === 'positive'
      ? 'text-emerald-500'
      : accent === 'negative'
        ? 'text-destructive'
        : 'text-foreground'
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} ${valueClass}`}>{value}</span>
    </div>
  )
}

export function PnLTab({ data, isLoading }: PnLTabProps) {
  if (isLoading) {
    return (
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-56 mb-4" />
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
            Данные P&amp;L ещё не рассчитаны.
          </p>
        </CardContent>
      </Card>
    )
  }

  const netAccent =
    data.netProfit == null
      ? undefined
      : data.netProfit >= 0
        ? ('positive' as const)
        : ('negative' as const)

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">
              P&amp;L — Отчёт о прибылях и убытках
            </h3>
            <span className="text-sm text-muted-foreground">
              {fmtPeriod(data.period)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Выручка
              </p>
              <Row label="Выручка" value={fmtRub(data.mrr)} />
              <Row
                label="Единовременные доходы"
                value={fmtRub(data.oneTimeRevenue)}
              />
              <Row label="Итого выручка" value={fmtRub(data.revenue)} bold />
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                Операционные расходы
              </p>
              <Row label="ФОТ" value={fmtRub(data.fot)} />
              <Row label="Соц. платежи" value={fmtRub(data.socialPayments)} />
              <Row label="Маркетинг" value={fmtRub(data.marketing)} />
              <Row label="Разработка" value={fmtRub(data.development)} />
              <Row label="G&A" value={fmtRub(data.gna)} />
              <Row label="Итого OPEX" value={fmtRub(data.totalOpex)} bold />
            </div>

            <div className="rounded-lg border border-border p-4">
              <Row label="EBITDA" value={fmtRub(data.ebitda)} bold />
              <Row
                label="Финансовые расходы"
                value={fmtRub(data.financialExpenses)}
              />
              <Row
                label="Чистая прибыль"
                value={fmtRub(data.netProfit)}
                bold
                accent={netAccent}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">Маржа</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                EBITDA margin
              </p>
              <p className="text-2xl font-bold mt-1">
                {fmtPct(data.ebitdaMargin)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Net margin
              </p>
              <p className="text-2xl font-bold mt-1">{fmtPct(data.netMargin)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
