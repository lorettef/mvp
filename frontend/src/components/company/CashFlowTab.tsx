import { useTranslation } from 'react-i18next'
import type { CashFlowResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      ? 'text-success'
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
      <Card className="border bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-64 mb-4" />
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border bg-card">
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
    <>
      <Card className="border bg-card">
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
      {data.months.length > 0 && (
        <Card className="border bg-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">{t('company.cashflow.monthly')}</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.period')}</TableHead>
                    <TableHead className="text-right">{t('company.cashflow.netProfit')}</TableHead>
                    <TableHead className="text-right">{t('company.cashflow.totalOperating')}</TableHead>
                    <TableHead className="text-right">{t('company.cashflow.totalCf')}</TableHead>
                    <TableHead className="text-right">{t('company.cashflow.closing')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.months.map((m) => (
                    <TableRow key={m.period}>
                      <TableCell className="font-medium text-foreground">{fmtPeriod(m.period)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtRub(m.netProfit)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtRub(m.operatingCf)}</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{fmtRub(m.totalCf)}</TableCell>
                      <TableCell className={`text-right tabular-nums font-medium ${(m.closingBalance ?? 0) < 0 ? 'text-destructive' : 'text-foreground'}`}>
                        {fmtRub(m.closingBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
