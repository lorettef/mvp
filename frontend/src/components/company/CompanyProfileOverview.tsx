import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { BusinessHealthResponse, CashFlowResponse, Cohort, Metric, PnLResponse, UnitEconomicsResponse } from '@/types/api'
import { Section } from '@/components/shared/section'
import { Button } from '@/components/ui/button'
import { QueryState } from '@/components/common/QueryState'
import { CompanyKpiStrip } from './CompanyKpiStrip'
import { CompanyCashFlowChart, CompanyCohortChart, CompanyEbitdaChart, CompanyRetentionTrendChart, CompanyRevenueChart, CompanyUnitEconomicsTrendChart } from './CompanyProfileCharts'

interface Source<T> {data?:T;isLoading:boolean;isError:boolean;error:unknown;refetch:()=>unknown}
interface Props {
  metrics:Source<Metric[]>;cohorts:Source<Cohort[]>;pnl:Source<PnLResponse>;cashflow:Source<CashFlowResponse>
  health:Source<BusinessHealthResponse>;unit:Source<UnitEconomicsResponse>
}
export function CompanyProfileOverview({ metrics,cohorts,pnl,cashflow,health,unit }:Props) {
  const { t } = useTranslation()
  const available = <T,>(source:Source<T>) => source.isError||source.isLoading?undefined:source.data
  const sources = [{name:'metrics',query:metrics},{name:'pnl',query:pnl},{name:'unit',query:unit},{name:'health',query:health}]
  const slot = (name:string,query:Source<unknown>,body:ReactNode) => <Section key={name} title={t(`company.profile.charts.${name}`)} className="h-full" headerClassName="px-4 py-3" contentClassName="p-4">
    <QueryState isLoading={query.isLoading} isError={query.isError} error={query.error} onRetry={()=>{void query.refetch()}}>{body}</QueryState>
  </Section>
  return <section aria-label={t('company.profile.title')} className="min-w-0 space-y-4">
    <h2 className="text-lg font-semibold">{t('company.profile.title')}</h2>
    <CompanyKpiStrip metrics={available(metrics)} health={available(health)} unit={available(unit)} periods={available(pnl)?.periods??[]} />
    {sources.filter(s=>s.query.isError).map(s=><div key={s.name} role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
      <span>{t('company.profile.sourceError',{source:t(`company.profile.sources.${s.name}`)})}</span>
      <Button type="button" size="sm" variant="outline" onClick={()=>{void s.query.refetch()}}>{t('common.retry')} · {t(`company.profile.sources.${s.name}`)}</Button>
    </div>)}
    <div role="group" aria-label={t('company.profile.grid')} className="grid min-w-0 grid-cols-1 items-stretch gap-4 lg:grid-cols-2 min-[1366px]:grid-cols-3">
      {slot('revenue',metrics,<CompanyRevenueChart metrics={available(metrics)??[]} />)}
      {slot('unit',metrics,<CompanyUnitEconomicsTrendChart metrics={available(metrics)??[]} />)}
      {slot('retention',metrics,<CompanyRetentionTrendChart metrics={available(metrics)??[]} />)}
      {slot('cohort',cohorts,<CompanyCohortChart cohorts={available(cohorts)??[]} />)}
      {slot('ebitda',pnl,<CompanyEbitdaChart periods={available(pnl)?.periods??[]} />)}
      {slot('cashflow',cashflow,<CompanyCashFlowChart months={available(cashflow)?.months??[]} />)}
    </div>
  </section>
}
