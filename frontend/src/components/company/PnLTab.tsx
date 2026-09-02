import { useTranslation } from 'react-i18next'
import type { PnLResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fmtPct, fmtPeriod, fmtRub } from '@/lib/format'

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
  const { t } = useTranslation()

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
            {t('company.pnl.empty')}
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
              {t('company.pnl.title')}
            </h3>
            <span className="text-sm text-muted-foreground">
              {fmtPeriod(data.period)}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-4">{data.summary}</p>

          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t('company.pnl.revenue')}
              </p>
              <Row label={t('company.pnl.revenue')} value={fmtRub(data.mrr)} />
              <Row
                label={t('company.pnl.oneTime')}
                value={fmtRub(data.oneTimeRevenue)}
              />
              <Row label={t('company.pnl.totalRevenue')} value={fmtRub(data.revenue)} bold />
            </div>

            <div className="rounded-lg border border-border p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                {t('company.pnl.opex')}
              </p>
              <Row label={t('company.pnl.fot')} value={fmtRub(data.fot)} />
              <Row label={t('company.pnl.socialPayments')} value={fmtRub(data.socialPayments)} />
              <Row label={t('company.pnl.marketing')} value={fmtRub(data.marketing)} />
              <Row label={t('company.pnl.development')} value={fmtRub(data.development)} />
              <Row label={t('company.pnl.gna')} value={fmtRub(data.gna)} />
              <Row label={t('company.pnl.totalOpex')} value={fmtRub(data.totalOpex)} bold />
            </div>

            <div className="rounded-lg border border-border p-4">
              <Row label="EBITDA" value={fmtRub(data.ebitda)} bold />
              <Row
                label={t('company.pnl.financial')}
                value={fmtRub(data.financialExpenses)}
              />
              <Row
                label={t('company.pnl.netProfit')}
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
          <h3 className="font-semibold text-foreground mb-4">{t('company.pnl.margin')}</h3>
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
