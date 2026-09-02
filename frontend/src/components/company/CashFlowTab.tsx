import { useTranslation } from 'react-i18next'
import type { CashFlowResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtPeriod, fmtRub } from '@/lib/format'

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
  const { t } = useTranslation()

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
            {t('company.cashflow.empty')}
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
            {t('company.cashflow.title')}
          </h3>
          <span className="text-sm text-muted-foreground">
            {fmtPeriod(data.period)}
          </span>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

        <div className="space-y-4">
          <Section title={t('company.cashflow.operating')}>
            <Row label={t('company.cashflow.netProfit')} value={fmtRub(data.netProfit)} />
            <Row label={t('company.cashflow.amortization')} value={fmtRub(data.amortization)} />
            <Row label={t('company.cashflow.totalOperating')} value={fmtRub(data.operatingCf)} bold />
          </Section>

          <Section title={t('company.cashflow.investing')}>
            <Row label={t('company.cashflow.capex')} value={fmtRub(data.capex)} />
            <Row
              label={t('company.cashflow.totalInvesting')}
              value={fmtRub(data.investingCf)}
              bold
            />
          </Section>

          <Section title={t('company.cashflow.financing')}>
            <Row label={t('company.cashflow.investments')} value={fmtRub(data.investments)} />
            <Row label={t('company.cashflow.credits')} value={fmtRub(data.credits)} />
            <Row label={t('company.cashflow.totalFinancing')} value={fmtRub(data.financingCf)} bold />
          </Section>

          <div className="rounded-lg border border-border p-4">
            <Row label={t('company.cashflow.totalCf')} value={fmtRub(data.totalCf)} bold />
            <Row label={t('company.cashflow.opening')} value={fmtRub(data.openingBalance)} />
            <Row
              label={t('company.cashflow.closing')}
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
