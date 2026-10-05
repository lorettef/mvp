import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/shared/section'
import { fmtPeriod, fmtRub, formatMonthLabel } from '@/lib/format'
import type { CompanyStatusItem } from '@/types/api'
import { companyRevenuePoints, type CompanyRevenuePoint } from './companyRevenue'

export interface CompanyRevenueChartProps {
  companies: CompanyStatusItem[]
  onResetFilters?: () => void
}

export function CompanyRevenueTooltip({ active, payload }: {
  active?: boolean
  payload?: { payload?: CompanyRevenuePoint }[]
}) {
  const { t, i18n } = useTranslation()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="max-w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
    <p className="font-semibold [overflow-wrap:anywhere]">{point.name}</p>
    <p className="mt-1 text-muted-foreground">{point.period
      ? formatMonthLabel(fmtPeriod(point.period), i18n.resolvedLanguage)
      : t('dashboard.summary.noFact')}</p>
    <div className="mt-2 space-y-1">
      <p>{t('common.fact')}: <span className="font-medium tabular-nums">{fmtRub(point.fact)}</span></p>
      <p>{t('common.plan')}: <span className="font-medium tabular-nums">{fmtRub(point.plan)}</span></p>
    </div>
  </div>
}

export function CompanyRevenueComparisonChart({ companies, onResetFilters }: CompanyRevenueChartProps) {
  const { t, i18n } = useTranslation()
  const descriptionId = useId()
  const data = useMemo(() => companyRevenuePoints(companies), [companies])
  const hasValues = data.some(point => point.fact !== null || point.plan !== null)
  const axisNumber = new Intl.NumberFormat(i18n.resolvedLanguage, { notation: 'compact', maximumFractionDigits: 1 })
  const title = t('dashboard.companyRevenue.comparisonTitle')
  return <div role="region" aria-label={title} aria-describedby={descriptionId} className="min-w-0">
    <Section title={title} className="min-w-0" headerClassName="px-4 py-3" contentClassName="p-4">
      <p id={descriptionId} className="sr-only">{t('dashboard.companyRevenue.comparisonDescription')}</p>
      {!hasValues ? <div className="space-y-3 py-12 text-center text-sm text-muted-foreground">
        <p>{t('dashboard.companyRevenue.comparisonEmpty')}</p>
        {data.length === 0 && onResetFilters && <Button variant="outline" size="sm" onClick={onResetFilters}>{t('dashboard.filters.reset')}</Button>}
      </div> : <div className="min-w-0 overflow-x-auto" tabIndex={data.length > 6 ? 0 : undefined}
        role="group" aria-label={title}>
        <div className="h-[300px] w-full" style={data.length > 6 ? { minWidth: data.length * 90 + 80 } : undefined}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={6} maxBarSize={36} margin={{ top: 8, right: 12, bottom: 20, left: 0 }} accessibilityLayer>
              <CartesianGrid stroke="hsl(var(--border))" strokeOpacity={0.7} vertical={false} />
              <XAxis dataKey="name" interval={0} height={58} angle={-25} textAnchor="end" tickLine={false} axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(name: string) => name.length > 16 ? `${name.slice(0, 15)}…` : name} />
              <YAxis width={72} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value: number) => `₽${axisNumber.format(value)}`} />
              <Tooltip content={<CompanyRevenueTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="fact" name={t('common.fact')} fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              <Bar dataKey="plan" name={t('common.plan')} fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>}
      {/* Full names, periods and missing/zero values remain available without SVG or hover. */}
      {data.length > 0 && <div className="sr-only"><table aria-label={title}>
        <thead><tr><th>{t('dashboard.summary.company')}</th><th>{t('dashboard.filters.period')}</th><th>{t('common.fact')}</th><th>{t('common.plan')}</th></tr></thead>
        <tbody>{data.map(point => <tr key={point.id}><th scope="row">{point.name}</th>
          <td>{point.period ? formatMonthLabel(fmtPeriod(point.period), i18n.resolvedLanguage) : t('dashboard.summary.noFact')}</td>
          <td>{fmtRub(point.fact)}</td><td>{fmtRub(point.plan)}</td>
        </tr>)}</tbody>
      </table></div>}
    </Section>
  </div>
}
