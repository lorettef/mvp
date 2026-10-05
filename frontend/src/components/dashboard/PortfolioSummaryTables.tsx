import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Section } from '@/components/shared/section'
import { MetricHelp } from '@/components/shared/metric-help'
import { fmtPct, fmtPeriod, fmtRub, formatMonthLabel } from '@/lib/format'
import type { CompanyStatusItem, DashboardMetricSnapshot } from '@/types/api'
import { PORTFOLIO_SELECTION, SummaryTableControls } from './SummaryTableControls'

interface SummaryMetric {
  key: Exclude<keyof DashboardMetricSnapshot, 'period'>
  labelKey: string
  format: 'currency' | 'count' | 'percent'
}

const planFactMetrics: SummaryMetric[] = [
  { key: 'revenue', labelKey: 'dashboard.summary.revenue', format: 'currency' },
  { key: 'newUnits', labelKey: 'dashboard.summary.newUnits', format: 'count' },
  { key: 'arpu', labelKey: 'dashboard.summary.arpu', format: 'currency' },
  { key: 'cac', labelKey: 'dashboard.summary.acquisitionCost', format: 'currency' },
]
const unitMetrics: SummaryMetric[] = [
  { key: 'ltv', labelKey: 'dashboard.summary.ltv', format: 'currency' },
  { key: 'cac', labelKey: 'dashboard.summary.cac', format: 'currency' },
  { key: 'churn', labelKey: 'dashboard.summary.churn', format: 'percent' },
]

interface SummaryTableProps {
  companies: CompanyStatusItem[]
  onOpen: (id: string) => void
  onResetFilters?: () => void
}

function PortfolioSummaryTable({ companies, onOpen, onResetFilters, metrics, showPlan, titleKey }: SummaryTableProps & {
  metrics: SummaryMetric[]
  showPlan: boolean
  titleKey: string
}) {
  const { t, i18n } = useTranslation()
  const [companyId, setCompanyId] = useState(PORTFOLIO_SELECTION)
  const [selectedMetrics, setSelectedMetrics] = useState(() => metrics.map(metric => metric.key as string))
  // Reset only this table's local choice when the shared response removes it.
  // The effective value is valid immediately, including before the effect runs.
  const activeCompanyId = companies.some(company => company.id === companyId) ? companyId : PORTFOLIO_SELECTION
  useEffect(() => {
    if (companyId !== activeCompanyId) setCompanyId(activeCompanyId)
  }, [companyId, activeCompanyId])

  const rows = activeCompanyId === PORTFOLIO_SELECTION ? companies : companies.filter(company => company.id === activeCompanyId)
  const visibleMetrics = metrics.filter(metric => selectedMetrics.includes(metric.key))
  const title = t(titleKey)
  const formatValue = (metric: SummaryMetric, snapshot: DashboardMetricSnapshot | null | undefined) => {
    const value = snapshot?.[metric.key]
    if (metric.format === 'currency') return fmtRub(value)
    if (metric.format === 'percent') return fmtPct(value)
    return value == null ? '—' : Math.round(value).toLocaleString(i18n.resolvedLanguage ?? 'ru')
  }
  const periodLabel = (company: CompanyStatusItem) => company.fact?.period
    ? t('dashboard.summary.period', { period: formatMonthLabel(fmtPeriod(company.fact.period), i18n.resolvedLanguage) })
    : t('dashboard.summary.noFact')
  const metricLabel = (metric: SummaryMetric) => metric.key === 'newUnits'
    ? <span onClick={event => event.stopPropagation()}><MetricHelp label={t(metric.labelKey)} description={t('dashboard.summary.newUnitsHint')} className="text-xs leading-relaxed" /></span>
    : t(metric.labelKey)
  const metricValue = (metric: SummaryMetric, company: CompanyStatusItem) => (
    <div className="space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-1 font-medium tabular-nums [overflow-wrap:anywhere]">
        {showPlan && <span className="text-xs font-normal text-muted-foreground">{t('common.fact')}{' '}</span>}
        <span>{formatValue(metric, company.fact)}</span>
      </div>
      {showPlan && <div className="flex flex-wrap items-baseline gap-x-1 text-xs text-muted-foreground tabular-nums [overflow-wrap:anywhere]">
        <span>{t('common.plan')}{' '}</span><span>{formatValue(metric, company.plan)}</span>
      </div>}
    </div>
  )
  const activate = (event: KeyboardEvent<HTMLElement>, id: string) => {
    if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      onOpen(id)
    }
  }
  const interactionClass = 'cursor-pointer transition-colors hover:bg-blue-50 focus-visible:bg-blue-50 dark:hover:bg-blue-950/30 dark:focus-visible:bg-blue-950/30'

  return (
    <div role="region" aria-label={title} className="min-w-0">
      <Section title={title} description={!showPlan ? t('dashboard.summary.factOnly') : undefined}
        className="min-w-0" headerClassName="px-4 py-3" contentClassName="p-0" actionsClassName="w-full sm:w-auto"
        actions={<SummaryTableControls companies={companies} companyId={activeCompanyId} onCompanyChange={setCompanyId}
          metrics={metrics.map(metric => ({ key: metric.key, label: t(metric.labelKey) }))}
          selectedMetrics={selectedMetrics} onMetricsChange={setSelectedMetrics} />}>
        {rows.length === 0 ? <div className="space-y-3 px-4 py-8 text-center text-sm text-muted-foreground">
          <p>{t('dashboard.summary.empty')}</p>
          {onResetFilters && <Button variant="outline" size="sm" onClick={onResetFilters}>{t('dashboard.filters.reset')}</Button>}
        </div> : <>
          <div className="hidden min-w-0 overflow-x-auto sm:block">
            <table className="w-full table-fixed text-sm" aria-label={title}>
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th scope="col" className="w-40 px-4 py-3 font-medium">{t('dashboard.summary.company')}</th>
                  {visibleMetrics.map(metric => <th key={metric.key} scope="col" className="px-3 py-3 font-medium leading-relaxed [overflow-wrap:anywhere]">
                    {metricLabel(metric)}
                  </th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(company => <tr key={company.id} tabIndex={0} aria-label={`${t('dashboard.table.open')}: ${company.name}`}
                  onClick={() => onOpen(company.id)} onKeyDown={event => activate(event, company.id)}
                  className={`border-b border-border/60 last:border-0 ${interactionClass}`}>
                  <th scope="row" className="px-4 py-3 text-left align-top font-medium [overflow-wrap:anywhere]">
                    {company.name}<p className="mt-1 text-xs font-normal text-muted-foreground">{periodLabel(company)}</p>
                  </th>
                  {visibleMetrics.map(metric => <td key={metric.key} className="px-3 py-3 align-top">{metricValue(metric, company)}</td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
          <ul aria-label={title} className="divide-y divide-border/60 sm:hidden">
            {rows.map(company => <li key={company.id}>
              <div role="link" tabIndex={0} aria-label={`${t('dashboard.table.open')}: ${company.name}`}
                onClick={() => onOpen(company.id)} onKeyDown={event => activate(event, company.id)}
                className={`space-y-3 px-4 py-4 ${interactionClass}`}>
                <div className="[overflow-wrap:anywhere]">
                  <h4 className="text-sm font-medium">{company.name}</h4>
                  <p className="mt-1 text-xs text-muted-foreground">{periodLabel(company)}</p>
                </div>
                <dl className="space-y-3">
                  {visibleMetrics.map(metric => <div key={metric.key}>
                    <dt className="mb-1 text-xs text-muted-foreground">{metricLabel(metric)}</dt>
                    <dd className="text-sm">{metricValue(metric, company)}</dd>
                  </div>)}
                </dl>
              </div>
            </li>)}
          </ul>
        </>}
      </Section>
    </div>
  )
}

export function PortfolioPlanFactTable(props: SummaryTableProps) {
  return <PortfolioSummaryTable {...props} metrics={planFactMetrics} showPlan titleKey="dashboard.summary.planFactTitle" />
}

export function PortfolioUnitEconomicsTable(props: SummaryTableProps) {
  return <PortfolioSummaryTable {...props} metrics={unitMetrics} showPlan={false} titleKey="dashboard.summary.unitTitle" />
}
