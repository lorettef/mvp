import { useTranslation } from 'react-i18next'
import type { Scenario, SensitivityResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtPct, fmtPercent, fmtRub } from '@/lib/format'

const fmtX = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(2)}×`

interface SensitivityTabProps {
  data?: SensitivityResponse
  isLoading?: boolean
}

interface Row {
  label: string
  base: string
  conservative: string
}

export function SensitivityTab({ data, isLoading }: SensitivityTabProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <Card className="border bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-56 mb-4" />
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
            {t('company.sensitivity.empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const b: Scenario = data.base
  const c: Scenario = data.conservative

  const rows: Row[] = [
    { label: 'MRR', base: fmtRub(b.mrr), conservative: fmtRub(c.mrr) },
    { label: 'CAC', base: fmtRub(b.cac), conservative: fmtRub(c.cac) },
    { label: 'LTV', base: fmtRub(b.ltv), conservative: fmtRub(c.ltv) },
    { label: 'Churn', base: fmtPct(b.churn), conservative: fmtPct(c.churn) },
    { label: 'LTV/CAC', base: fmtX(b.ltvCac), conservative: fmtX(c.ltvCac) },
    { label: 'FCF', base: fmtRub(b.fcf), conservative: fmtRub(c.fcf) },
    { label: t('company.sensitivity.growthRate'), base: fmtPercent(b.growthRate), conservative: fmtPercent(c.growthRate) },
    { label: 'Terminal Value', base: fmtRub(b.terminalValue), conservative: fmtRub(c.terminalValue) },
    { label: 'Equity Value', base: fmtRub(b.equityValue), conservative: fmtRub(c.equityValue) },
  ]

  const deltaPositive = data.equityDelta != null && data.equityDelta >= 0

  return (
    <div className="space-y-6">
      <Card className="border bg-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            {t('company.sensitivity.title')}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('company.sensitivity.deltaEquity')}
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  data.equityDelta == null
                    ? 'text-foreground'
                    : deltaPositive
                      ? 'text-success'
                      : 'text-destructive'
                }`}
              >
                {fmtRub(data.equityDelta)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('company.sensitivity.deltaRelative')}
              </p>
              <p
                className={`text-2xl font-bold mt-1 ${
                  data.equityDeltaPct == null
                    ? 'text-foreground'
                    : deltaPositive
                      ? 'text-success'
                      : 'text-destructive'
                }`}
              >
                {data.equityDeltaPct == null
                  ? '—'
                  : `${data.equityDeltaPct >= 0 ? '+' : ''}${data.equityDeltaPct.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border bg-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">{t('company.sensitivity.comparison')}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('company.sensitivity.indicator')}</TableHead>
                <TableHead className="text-right">{t('company.sensitivity.base')}</TableHead>
                <TableHead className="text-right">{t('company.sensitivity.conservative')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.label}>
                  <TableCell className="text-muted-foreground">{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{row.base}</TableCell>
                  <TableCell className="text-right tabular-nums text-foreground">{row.conservative}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
