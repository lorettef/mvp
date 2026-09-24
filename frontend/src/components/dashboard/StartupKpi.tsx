import { useTranslation } from 'react-i18next'
import { CalendarClock } from 'lucide-react'
import type { CatalogResponse, Company, Metric, UnitEconomicsResponse } from '@/types/api'
import { MetricCard } from '@/components/shared/metric-card'
import { fmtPct, fmtRub } from '@/lib/format'
import {
  factSeries,
  latestFact,
  metricNumber,
  planForPeriod,
  relativeDeltaPct,
  selectKpiSpecs,
} from '@/lib/kpi'

const CURRENCY_KEYS = new Set(['revenue', 'arpu', 'marketing_spend', 'ltv', 'cac'])
const PERCENT_KEYS = new Set(['retention_rate', 'churn'])
const INVERT_KEYS = new Set(['churn', 'cac', 'marketing_spend'])

function formatValue(key: string, v: number | null): string {
  if (v == null) return '—'
  if (CURRENCY_KEYS.has(key)) return fmtRub(v)
  if (PERCENT_KEYS.has(key)) return fmtPct(v)
  if (key === 'new_units') return String(Math.round(v))
  return String(v)
}

export function StartupKpi({
  company,
  catalog,
  metrics,
  unitEconomics,
}: {
  company: Company
  catalog: CatalogResponse | undefined
  metrics: Metric[]
  unitEconomics: UnitEconomicsResponse | undefined
}) {
  const { t } = useTranslation()
  const specs = selectKpiSpecs(company, catalog)
  const fact = latestFact(metrics)
  const plan = planForPeriod(metrics, fact?.period)
  const metricHelp = {
    ltv: t('overview.metricHelp.ltv'),
    arpu: t('overview.metricHelp.arpu'),
    retention_rate: t('overview.metricHelp.retention'),
    cac: t('overview.metricHelp.cac'),
    churn: t('overview.metricHelp.churn'),
  }

  const cards = specs.map((spec) => {
    const series = factSeries(metrics, spec.key)
    const value = metricNumber(fact, spec.key)
    const delta = relativeDeltaPct(series)
    const planFact =
      spec.key === 'revenue'
        ? { plan: fmtRub(plan?.revenue ?? null), fact: fmtRub(fact?.revenue ?? null) }
        : null
    return (
      <MetricCard
        key={spec.key}
        label={spec.label}
        description={metricHelp[spec.key as keyof typeof metricHelp]}
        value={formatValue(spec.key, value)}
        delta={delta}
        deltaSuffix="%"
        invert={INVERT_KEYS.has(spec.key)}
        sparkline={series}
        planFact={planFact}
        period={fact ? fact.period.slice(0, 7) : undefined}
      />
    )
  })

  if (unitEconomics?.runwayMonths != null) {
    cards.push(
      <MetricCard
        key="runway"
        label={t('overview.kpi.runway')}
        value={t('overview.kpi.runwayMonths', { value: unitEconomics.runwayMonths })}
        icon={<CalendarClock className="h-4 w-4" />}
        context={unitEconomics.monthlyBurn != null ? t('overview.kpi.burnPerMonth', { value: fmtRub(unitEconomics.monthlyBurn) }) : undefined}
      />,
    )
  }

  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{cards}</div>
}
