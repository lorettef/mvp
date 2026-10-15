import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BudgetUpsert, MetricUpsert, PnLBudgetSource, PnLMetricSource, PnLPeriod, PnLResponse, PnLScenario } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricHelp } from '@/components/shared/metric-help'
import { fmtPct, fmtRub, formatMonthLabel } from '@/lib/format'
import { UnitEconomicsSourceEditor } from './UnitEconomicsSourceEditor'
import { BudgetSourceEditor } from './BudgetSourceEditor'
import { FinanceMatrix, FinanceSourceValue } from './FinanceMatrix'
import { BudgetInlineCell, MetricInlineCell } from './SourceInlineCells'
import { PnLEbitdaChart } from './PnLEbitdaChart'
import type { BudgetInputField } from '@/lib/financialSourceForm'

interface PnLTabProps {
  industry?: string | null
  data?: PnLResponse
  isLoading?: boolean
  canEdit?: boolean
  metricLabel?: (key: string, fallback: string) => string
  onSaveMetric?: (data: MetricUpsert) => Promise<unknown>
  onDeleteMetric?: (id: string) => Promise<unknown>
  onSaveBudget?: (data: BudgetUpsert) => Promise<unknown>
  onDeleteBudget?: (id: string) => Promise<unknown>
  isMetricPending?: (source: PnLMetricSource) => boolean
  isBudgetPending?: (source: PnLBudgetSource) => boolean
}

type ScenarioType = 'plan' | 'fact'
type SourceKind = 'metric' | 'budget'
const rows: Array<{ key: Exclude<keyof PnLScenario, 'metricSource' | 'budgetSource'>; label: string; source?: SourceKind; percent?: boolean; bold?: boolean }> = [
  { key: 'revenue', label: 'revenue', source: 'metric', bold: true },
  { key: 'cogs', label: 'cogs', source: 'budget' },
  { key: 'grossProfit', label: 'grossProfit', bold: true },
  { key: 'grossMargin', label: 'grossMargin', percent: true },
  { key: 'fot', label: 'fot', source: 'budget' },
  { key: 'socialPayments', label: 'socialPayments' },
  { key: 'marketing', label: 'marketing', source: 'budget' },
  { key: 'development', label: 'development', source: 'budget' },
  { key: 'gna', label: 'gna', source: 'budget' },
  { key: 'totalOpex', label: 'totalOpex', bold: true },
  { key: 'ebitda', label: 'ebitda', bold: true },
  { key: 'financialExpenses', label: 'financial' },
  { key: 'netProfit', label: 'netProfit', bold: true },
  { key: 'ebitdaMargin', label: 'ebitdaMargin', percent: true },
  { key: 'netMargin', label: 'netMargin', percent: true },
]

export function PnLTab({ industry, data, isLoading, canEdit = false, metricLabel, onSaveMetric, onDeleteMetric, onSaveBudget, onDeleteBudget, isMetricPending = () => false, isBudgetPending = () => false }: PnLTabProps) {
  const { t, i18n } = useTranslation()
  const selectorId = useId()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [editingMetric, setEditingMetric] = useState<PnLMetricSource | null>(null)
  const [editingBudget, setEditingBudget] = useState<PnLBudgetSource | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [missing, setMissing] = useState<SourceKind | null>(null)
  // Presentation is defensive about order, but never calculates financial values.
  const periods = [...(data?.periods ?? [])].sort((a, b) => a.period.localeCompare(b.period))
  const selected = periods.find((p) => p.period === selectedMonth) ?? periods[periods.length - 1]
  const monthLabel = (period: string) => formatMonthLabel(period.slice(0, 7), i18n.language)
  const editable = (source?: SourceKind) => Boolean(canEdit && (source === 'metric' ? onSaveMetric && onDeleteMetric : source === 'budget' ? onSaveBudget && onDeleteBudget : false))
  const openSource = (period: PnLPeriod, type: ScenarioType, kind: SourceKind, remove = false) => {
    if (!editable(kind)) return
    const scenario = period[type]
    setMissing(null)
    setDeleting(remove)
    if (kind === 'metric' && scenario?.metricSource?.period === period.period && scenario.metricSource.type === type) setEditingMetric(scenario.metricSource)
    else if (kind === 'budget' && scenario?.budgetSource?.period === period.period && scenario.budgetSource.type === type) setEditingBudget(scenario.budgetSource)
    else setMissing(kind)
  }

  const matrixRows = rows.map((row) => ({
    ...row,
    labelKey: row.label,
    label: row.source ? t(`company.pnl.${row.label}`) : <MetricHelp label={t(`company.pnl.${row.label}`)} description={t(row.key === 'netProfit' || row.key === 'netMargin' ? 'company.pnl.beforeTaxHelp' : 'company.pnl.calculatedHelp')} />,
  }))
  const matrix = (visiblePeriods: PnLPeriod[], mobile: boolean) => <FinanceMatrix
    periods={visiblePeriods.map((period) => period.period)} rows={matrixRows} mobile={mobile}
    columnLabel={t('company.pnl.indicator')} tableLabel={t(mobile ? 'company.pnl.mobileMatrix' : 'company.pnl.matrix')}
    renderCell={(row, period, type, isMobile) => {
      const pair = visiblePeriods.find((item) => item.period === period)!
      const value = pair[type]?.[row.key]
      const metric = t(`company.pnl.${row.labelKey}`)
      const label = t('company.pnl.editCell', { metric, period: monthLabel(period), type: t(`common.${type}`) })
      const metricSource = pair[type]?.metricSource
      const budgetSource = pair[type]?.budgetSource
      // Never route a cell to a snapshot from another period/scenario.
      const matchingMetric = metricSource?.period === period && metricSource.type === type ? metricSource : undefined
      const matchingBudget = budgetSource?.period === period && budgetSource.type === type ? budgetSource : undefined
      const busy = row.source === 'metric' && matchingMetric ? isMetricPending(matchingMetric)
        : row.source === 'budget' && matchingBudget ? isBudgetPending(matchingBudget) : false
      const inline = canEdit && row.source === 'metric' && matchingMetric && onSaveMetric
        ? <MetricInlineCell key={matchingMetric.id} source={matchingMetric} field="revenue" label={label} busy={busy} onSave={onSaveMetric}>{fmtRub(value)}</MetricInlineCell>
        : canEdit && row.source === 'budget' && matchingBudget && onSaveBudget
          ? <BudgetInlineCell key={matchingBudget.id} source={matchingBudget} field={row.key as BudgetInputField} label={label} busy={busy} onSave={onSaveBudget}>{fmtRub(value)}</BudgetInlineCell>
          : undefined
      return <FinanceSourceValue mobile={isMobile} missing={value == null}
        label={label} inline={inline} busy={busy}
        actionLabel={t('company.pnl.editAction')}
        onDelete={editable(row.source) && (row.source === 'metric' ? matchingMetric : matchingBudget) ? () => openSource(pair, type, row.source!, true) : undefined}
        onOpen={editable(row.source) ? () => openSource(pair, type, row.source!) : undefined}>
        {row.percent ? fmtPct(value) : fmtRub(value)}
      </FinanceSourceValue>
    }}
  />

  if (isLoading) return <Card><CardContent className="p-4"><Skeleton className="mb-4 h-6 w-56" /><Skeleton className="h-64 w-full" /></CardContent></Card>
  if (!periods.length) return <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">{t('company.pnl.empty')}</p></CardContent></Card>

  return <Card className="min-w-0 max-w-full border bg-card">
    <CardContent className="min-w-0 p-3 sm:p-4">
      <h3 className="font-semibold text-foreground">{t('company.pnl.title')}</h3>
      <p className="mt-1 mb-3 text-xs text-muted-foreground">{t(canEdit ? 'company.pnl.editHint' : 'company.pnl.calculatedHelp')}</p>
      {missing && <p role="status" className="mb-3 text-sm text-muted-foreground">{t(missing === 'metric' ? 'company.pnl.missingMetric' : 'company.pnl.missingBudget')}</p>}
      <section className="mb-4 min-w-0" aria-label={t('company.profile.charts.ebitda')}>
        <h4 className="mb-3 font-medium">{t('company.profile.charts.ebitda')}</h4>
        <PnLEbitdaChart periods={periods} />
      </section>
      <div className="hidden min-w-0 max-w-full overflow-x-auto md:block" data-testid="pnl-desktop">{matrix(periods, false)}</div>
      <div className="md:hidden" data-testid="pnl-mobile">
        <label htmlFor={selectorId} className="mb-1 block text-sm font-medium">{t('common.period')}</label>
        <select id={selectorId} className="mb-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={selected?.period ?? ''} onChange={(event) => { setSelectedMonth(event.target.value); setMissing(null) }}>
          {periods.map((period) => <option key={period.period} value={period.period}>{monthLabel(period.period)}</option>)}
        </select>
        {selected && matrix([selected], true)}
      </div>
    </CardContent>
    {canEdit && editingMetric && onSaveMetric && onDeleteMetric && <UnitEconomicsSourceEditor key={editingMetric.id} initialDelete={deleting} source={editingMetric} editComment metricLabel={metricLabel} onSave={onSaveMetric} onDelete={onDeleteMetric} onClose={() => setEditingMetric(null)} />}
    {canEdit && editingBudget && onSaveBudget && onDeleteBudget && <BudgetSourceEditor key={editingBudget.id} industry={industry} initialDelete={deleting} source={editingBudget} onSave={onSaveBudget} onDelete={onDeleteBudget} onClose={() => setEditingBudget(null)} />}
  </Card>
}
