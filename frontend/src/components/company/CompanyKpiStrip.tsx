import { useTranslation } from 'react-i18next'
import type { BusinessHealthResponse, Metric, PnLPeriod, UnitEconomicsResponse } from '@/types/api'
import { companyMarginSource, companyMetricOverview } from '@/lib/companyOverview'
import { fmtPct, fmtRub, fmtSignedPct, formatMonthLabel } from '@/lib/format'
import { MetricCard } from '@/components/shared/metric-card'

export function CompanyKpiStrip({ metrics=[],health,unit,periods=[] }: {
  metrics?:Metric[];health?:BusinessHealthResponse;unit?:UnitEconomicsResponse;periods?:PnLPeriod[]
}) {
  const { t,i18n } = useTranslation()
  const { current,previous,revenue,growth,status } = companyMetricOverview(metrics)
  const margin = companyMarginSource(periods)
  const sourceLabel = (source:{period:string;type:'plan'|'fact'}|null|undefined) => source
    ? `${formatMonthLabel(source.period.slice(0,7),i18n.language)} · ${t(`common.${source.type}`)}` : undefined
  const unavailable = t('company.profile.unavailable')
  const healthLabel = health ? t(`overview.health.${health.status === 'no_data'?'noData':health.status}`) : '—'
  return <div role="group" aria-label={t('company.profile.kpi')} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1366px]:grid-cols-6">
    <MetricCard compact label={t('company.profile.revenue')} value={fmtRub(revenue)} period={sourceLabel(current)} description={revenue===null?unavailable:undefined} />
    <MetricCard compact label={t('company.profile.growth')} value={fmtSignedPct(growth)} description={growth===null?unavailable:t('company.profile.growthHelp')}
      period={current&&previous?`${sourceLabel(current)} · ${t('company.profile.comparedWith')} ${formatMonthLabel(previous.period.slice(0,7),i18n.language)}`:undefined} />
    <MetricCard compact label={t('company.profile.performance')} value={t(`company.profile.statuses.${status}`)} period={sourceLabel(current)}
      description={t('company.profile.performanceHelp')} />
    <MetricCard compact label={t('company.profile.health')} value={healthLabel} description={!health?unavailable:health.summary} />
    <MetricCard compact label={t('company.profile.runway')} value={unit?.runwayMonths!=null?t('overview.kpi.runwayMonths',{value:unit.runwayMonths}):'—'}
      description={unit?.runwayMonths==null?unavailable:t('company.profile.runwayHelp')} period={sourceLabel(unit?.sourceMetric)} />
    <MetricCard compact label={t('company.profile.margin')} value={fmtPct(margin?.value)} period={sourceLabel(margin)} description={!margin?unavailable:t('company.profile.marginHelp')} />
  </div>
}
