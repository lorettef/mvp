import { useTranslation } from 'react-i18next'
import type { CreditForecastResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fmtPercent, fmtPeriod, fmtRub } from '@/lib/format'

interface CreditTabProps {
  data?: CreditForecastResponse
  isLoading?: boolean
}

export function CreditTab({ data, isLoading }: CreditTabProps) {
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
            {t('company.credit.empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    { label: t('company.credit.keyRate'), value: fmtPercent(data.keyRate) },
    { label: t('company.credit.creditRate'), value: fmtPercent(data.creditRate) },
    { label: t('company.credit.openingCash'), value: fmtRub(data.openingCash) },
    {
      label: t('company.credit.needed'),
      value: fmtRub(data.fundingNeed),
      accent: data.gaps.length > 0,
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="border bg-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            {t('company.credit.title')}
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
        <Card className="border bg-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">
              {t('company.credit.gaps')}
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
                      {t('company.credit.gap', { value: fmtRub(g.gap) })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">
                      {t('company.credit.credit', { value: fmtRub(g.creditAmount) })}
                    </p>
                    <Badge variant="outline">{fmtPercent(g.rate)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border bg-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-4">
            {t('company.credit.monthly')}
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.month')}</TableHead>
                  <TableHead>{t('common.period')}</TableHead>
                  <TableHead className="text-right">{t('company.credit.revenue')}</TableHead>
                  <TableHead className="text-right">{t('company.credit.opex')}</TableHead>
                  <TableHead className="text-right">{t('company.credit.netCf')}</TableHead>
                  <TableHead className="text-right">{t('company.credit.balance')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="text-muted-foreground">{m.month}</TableCell>
                    <TableCell className="font-medium text-foreground">{fmtPeriod(m.period)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtRub(m.revenue)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtRub(m.opex)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtRub(m.netCf)}</TableCell>
                    <TableCell className={`text-right tabular-nums font-medium ${m.balanceAfter < 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {fmtRub(m.balanceAfter)}
                    </TableCell>
                  </TableRow>
                ))}
                {data.months.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t('company.credit.emptyAddMrr')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
