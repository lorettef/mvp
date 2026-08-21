import type { CashFlowResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

const fmtPeriod = (period: string | null) => (period ? period.slice(0, 7) : '—')

interface CashFlowTabProps {
  data?: CashFlowResponse
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
        {title}
      </p>
      {children}
    </div>
  )
}

export function CashFlowTab({ data, isLoading }: CashFlowTabProps) {
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
            Данные Cash Flow ещё не рассчитаны.
          </p>
        </CardContent>
      </Card>
    )
  }

  const closingAccent =
    data.closingBalance == null
      ? undefined
      : data.closingBalance >= 0
        ? ('positive' as const)
        : ('negative' as const)

  return (
    <Card className="border bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">
            Cash Flow — Движение денежных средств
          </h3>
          <span className="text-sm text-muted-foreground">
            {fmtPeriod(data.period)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

        <div className="space-y-4">
          <Section title="Операционный CF">
            <Row label="Чистая прибыль" value={fmtRub(data.netProfit)} />
            <Row label="Амортизация" value={fmtRub(data.amortization)} />
            <Row label="Итого операционный CF" value={fmtRub(data.operatingCf)} bold />
          </Section>

          <Section title="Инвестиционный CF">
            <Row label="CAPEX (покупка ОС)" value={fmtRub(data.capex)} />
            <Row
              label="Итого инвестиционный CF"
              value={fmtRub(data.investingCf)}
              bold
            />
          </Section>

          <Section title="Финансовый CF">
            <Row label="Инвестиции" value={fmtRub(data.investments)} />
            <Row label="Кредиты" value={fmtRub(data.credits)} />
            <Row label="Итого финансовый CF" value={fmtRub(data.financingCf)} bold />
          </Section>

          <div className="rounded-lg border border-border p-4">
            <Row label="Итого CF" value={fmtRub(data.totalCf)} bold />
            <Row label="Остаток на начало" value={fmtRub(data.openingBalance)} />
            <Row
              label="Остаток на конец месяца"
              value={fmtRub(data.closingBalance)}
              bold
              accent={closingAccent}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
