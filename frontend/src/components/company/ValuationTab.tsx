import { useTranslation } from 'react-i18next'
import type { ValuationResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtPercent, fmtRub } from '@/lib/format'

const fmtX = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toFixed(2)}×`

interface ValuationTabProps {
  data?: ValuationResponse
  isLoading?: boolean
}

export function ValuationTab({ data, isLoading }: ValuationTabProps) {
  const { t } = useTranslation()

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
            {t('company.valuation.empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    { label: t('company.valuation.equityValue'), value: fmtRub(data.equityValue) },
    { label: t('company.valuation.terminalValue'), value: fmtRub(data.terminalValue) },
    { label: t('company.valuation.ps'), value: fmtX(data.psRatio) },
    { label: t('company.valuation.perEmployee'), value: fmtRub(data.valuePerEmployee) },
  ]

  return (
    <div className="space-y-6">
      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            {t('company.valuation.title')}
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
          <h3 className="font-semibold text-foreground mb-4">{t('company.valuation.params')}</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {[
              { label: t('company.valuation.keyRate'), value: fmtPercent(data.keyRate) },
              { label: t('company.valuation.discountRate'), value: fmtPercent(data.discountRate) },
              { label: t('company.valuation.growthRate'), value: fmtPercent(data.growthRate) },
              { label: t('company.valuation.fcf'), value: fmtRub(data.fcf) },
              { label: t('company.valuation.netDebt'), value: fmtRub(data.netDebt) },
              { label: t('company.valuation.annualRevenue'), value: fmtRub(data.revenueAnnual) },
              { label: t('company.valuation.headcount'), value: t('common.people', { count: data.headcount }) },
              { label: t('company.valuation.geography'), value: data.geography },
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
