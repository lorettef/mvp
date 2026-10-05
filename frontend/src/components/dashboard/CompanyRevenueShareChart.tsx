import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/shared/section'
import { fmtPct, fmtRub } from '@/lib/format'
import { companyRevenueShares } from './companyRevenue'
import type { CompanyRevenueChartProps } from './CompanyRevenueComparisonChart'

export function CompanyRevenueShareChart({ companies, onResetFilters }: CompanyRevenueChartProps) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const { data, total } = useMemo(() => companyRevenueShares(companies), [companies])
  const title = t('dashboard.companyRevenue.shareTitle')
  return <div role="region" aria-label={title} aria-describedby={descriptionId} className="min-w-0">
    <Section title={title} className="flex h-full min-w-0 flex-col" headerClassName="px-4 py-3" contentClassName="flex flex-1 flex-col justify-center p-4">
      <p id={descriptionId} className="sr-only">{t('dashboard.companyRevenue.shareDescription')}</p>
      {total === 0 ? <div className="space-y-3 py-12 text-center text-sm text-muted-foreground">
        <p>{t('dashboard.companyRevenue.shareEmpty')}</p>
        {companies.length === 0 && onResetFilters && <Button variant="outline" size="sm" onClick={onResetFilters}>{t('dashboard.filters.reset')}</Button>}
      </div> : <>
        <div className="flex min-h-64 min-w-0 flex-wrap items-center justify-center gap-4">
          <div className="relative h-52 w-52 shrink-0">
            <div aria-hidden="true" className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="revenue" nameKey="name" innerRadius={66} outerRadius={96}
                    paddingAngle={0} strokeWidth={0} isAnimationActive={false}>
                    {data.map(point => <Cell key={point.id} fill={point.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string, item) => [`${fmtRub(value)} · ${fmtPct(item.payload.share as number)}`, name]}
                    contentStyle={{ borderRadius: 8, background: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-semibold tabular-nums">{data.length}</span>
              <span className="text-xs text-muted-foreground">{t('dashboard.companyRevenue.companies', { count: data.length })}</span>
            </div>
          </div>
          <ul aria-label={t('dashboard.companyRevenue.shareLegend')} tabIndex={data.length > 5 ? 0 : undefined}
            className="max-h-64 min-w-0 basis-40 flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
            {data.map(point => <li key={point.id} className="flex min-w-0 items-start gap-2">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: point.color }} aria-hidden="true" />
              <div className="min-w-0"><p className="font-medium [overflow-wrap:anywhere]">{point.name}</p>
                <p className="mt-0.5 text-muted-foreground tabular-nums">{fmtRub(point.revenue)} · {fmtPct(point.share)}</p>
              </div>
            </li>)}
          </ul>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('dashboard.companyRevenue.total')}: <span className="tabular-nums">{fmtRub(total)}</span></p>
      </>}
    </Section>
  </div>
}
