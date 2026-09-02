import { useTranslation } from 'react-i18next'
import type { Scenario, SensitivityResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
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
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-56 mb-4" />
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
      <Card className="border bg-card/50">
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
                      ? 'text-emerald-500'
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
                      ? 'text-emerald-500'
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

      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">{t('company.sensitivity.comparison')}</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left font-medium px-4 py-3">{t('company.sensitivity.indicator')}</th>
                <th className="text-left font-medium px-4 py-3">{t('company.sensitivity.base')}</th>
                <th className="text-left font-medium px-4 py-3">{t('company.sensitivity.conservative')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.label}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                >
                  <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                  <td className="px-4 py-3 text-foreground">{row.base}</td>
                  <td className="px-4 py-3 text-foreground">{row.conservative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
