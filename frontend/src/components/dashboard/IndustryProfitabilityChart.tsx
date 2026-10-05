import { useId, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Section } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { fmtPct, fmtRub } from '@/lib/format'
import type { IndustryProfitabilityItem } from '@/types/api'

interface ProfitabilityPoint extends IndustryProfitabilityItem { label: string }
const marginLabel = (value: number | null) => fmtPct(value).replace(/^-/, '−')
const industryKey = (industry: string | null) => industry === null ? 'null' : `slug:${industry}`

// Wrap labels instead of shrinking industry names on narrow screens.
function IndustryTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value: string } }) {
  const words = (payload?.value ?? '').match(/.{1,18}(?:\s|$)|\S{1,18}/g) ?? []
  return <text x={x - 8} y={y} textAnchor="end" fill="hsl(var(--muted-foreground))" fontSize={11}>
    {words.map((word, index) => <tspan key={index} x={x - 8} dy={index === 0 ? -(words.length - 1) * 7 + 4 : 14}>{word.trim()}</tspan>)}
  </text>
}

export function IndustryProfitabilityTooltip({ active, payload }: {
  active?: boolean
  payload?: { payload?: ProfitabilityPoint }[]
}) {
  const { t } = useTranslation()
  const point = payload?.[0]?.payload
  if (!active || !point) return null
  return <div className="max-w-72 rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
    <p className="font-semibold [overflow-wrap:anywhere]">{point.label}</p>
    <dl className="mt-2 space-y-1">
      {[
        [t('dashboard.profitability.margin'), marginLabel(point.ebitdaMargin)],
        [t('dashboard.profitability.ebitda'), fmtRub(point.ebitda)],
        [t('dashboard.summary.revenue'), fmtRub(point.revenue)],
        [t('dashboard.profitability.opex'), fmtRub(point.totalOpex)],
      ].map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-x-4"><dt>{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}
    </dl>
    <p className="mt-2 text-muted-foreground">{t('dashboard.profitability.included', { included: point.companiesIncluded, total: point.companiesTotal })}</p>
    {point.companiesIncluded < point.companiesTotal && <p className="mt-1 text-muted-foreground">{t('dashboard.profitability.incomplete')}</p>}
  </div>
}

export function IndustryProfitabilityChart({ data, industryLabel, onResetFilters }: {
  data: IndustryProfitabilityItem[]
  industryLabel: (slug: string) => string
  onResetFilters?: () => void
}) {
  const { t } = useTranslation()
  const descriptionId = useId()
  const points = useMemo(() => data.map(item => ({ ...item,
    label: item.industry === null ? t('dashboard.profitability.unspecified') : industryLabel(item.industry),
  })), [data, industryLabel, t])
  const hasMargins = points.some(point => point.ebitdaMargin !== null)
  const margins = points.flatMap(point => point.ebitdaMargin === null ? [] : [point.ebitdaMargin])
  const axisMin = Math.floor(Math.min(0, ...margins) * 10) / 10
  const axisMax = Math.ceil(Math.max(0, ...margins) * 10) / 10 || 0.1
  // Include a labelled zero on both positive-only and mixed-sign scales.
  const axisTicks = [...new Set([axisMin, axisMin / 2, 0, axisMax / 2, axisMax])]
  const title = t('dashboard.profitability.title')
  const qualityNotes = points.filter(point => point.companiesIncluded < point.companiesTotal || point.ebitdaMargin === null)
  return <div role="region" aria-label={title} aria-describedby={descriptionId} className="min-w-0">
    <Section title={title} description={t('dashboard.profitability.subtitle')} className="min-w-0"
      headerClassName="px-4 py-3" contentClassName="p-4">
      <p id={descriptionId} className="sr-only">{t('dashboard.profitability.description')}</p>
      {!hasMargins ? <div className="space-y-3 py-8 text-center text-sm text-muted-foreground">
        <p>{t('dashboard.profitability.empty')}</p>
        {points.length === 0 && onResetFilters && <Button variant="outline" size="sm" onClick={onResetFilters}>{t('dashboard.filters.reset')}</Button>}
      </div> : <div className="min-w-0" style={{ height: Math.max(240, points.length * 56 + 40) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} layout="vertical" maxBarSize={24} margin={{ top: 8, right: 24, bottom: 8, left: 0 }} accessibilityLayer>
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.7} strokeDasharray="3 3" />
            <XAxis type="number" dataKey="ebitdaMargin" tickFormatter={marginLabel} tickLine={false} axisLine={false}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              domain={[axisMin, axisMax]} ticks={axisTicks} />
            <YAxis type="category" dataKey="label" width={124} interval={0} tickLine={false} axisLine={false} tick={<IndustryTick />} />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
            <Tooltip content={<IndustryProfitabilityTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }} />
            <Bar dataKey="ebitdaMargin" name={t('dashboard.profitability.margin')} radius={3} isAnimationActive={false}>
              {points.map(point => <Cell key={industryKey(point.industry)} fill={`hsl(var(--chart-${(point.ebitdaMargin ?? 0) < 0 ? 5 : 2}))`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>}
      {qualityNotes.length > 0 && <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
        {qualityNotes.map(point => <li key={industryKey(point.industry)} className="[overflow-wrap:anywhere]">
          <span className="font-medium">{point.label}: </span>
          {t('dashboard.profitability.included', { included: point.companiesIncluded, total: point.companiesTotal })}
          {point.ebitdaMargin === null && point.companiesIncluded > 0 && <span> · {t('dashboard.profitability.zeroRevenue')}</span>}
        </li>)}
      </ul>}
      <div className="sr-only"><table aria-label={title}>
        <thead><tr><th>{t('dashboard.profitability.industry')}</th><th>{t('dashboard.profitability.margin')}</th><th>{t('dashboard.profitability.ebitda')}</th>
          <th>{t('dashboard.summary.revenue')}</th><th>{t('dashboard.profitability.opex')}</th><th>{t('dashboard.profitability.coverage')}</th></tr></thead>
        <tbody>{points.map(point => <tr key={industryKey(point.industry)}><th scope="row">{point.label}</th>
          <td>{marginLabel(point.ebitdaMargin)}</td><td>{fmtRub(point.ebitda)}</td><td>{fmtRub(point.revenue)}</td><td>{fmtRub(point.totalOpex)}</td>
          <td>{t('dashboard.profitability.included', { included: point.companiesIncluded, total: point.companiesTotal })}</td>
        </tr>)}</tbody>
      </table></div>
    </Section>
  </div>
}
