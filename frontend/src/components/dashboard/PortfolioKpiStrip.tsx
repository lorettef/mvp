import { useTranslation } from 'react-i18next'
import { Building2, TrendingUp, CircleCheck, AlertTriangle, CalendarClock } from 'lucide-react'
import type { DashboardResponse } from '@/types/api'
import { MetricCard } from '@/components/shared/metric-card'
import { fmtRub, fmtSignedPct } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Shared presentation and existing KPI semantics; no queries or mutations. */
export function PortfolioKpiStrip({ data, className }: { data?: DashboardResponse; className?: string }) {
  const { t } = useTranslation()
  const total = data?.totalCompanies ?? 0
  const onTrack = data?.onTrack ?? 0
  const behind = data?.behind ?? 0
  // «Выполняют план» — доля компаний С планом, которые его выполняют. Компании
  // без плана (no_plan) и без данных (no_data) не входят в знаменатель, иначе
  // пустой портфель показывал бы вводящие в заблуждение «0%».
  const planCompanies = onTrack + behind
  const onTrackPct = planCompanies > 0 ? Math.round((onTrack / planCompanies) * 100) : null

  return (
    <div className={cn('grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 min-[1366px]:grid-cols-6', className)}>
      <MetricCard compact label={t('dashboard.cards.companies')} value={String(total)} icon={<Building2 className="h-4 w-4" />} />
      <MetricCard compact label={t('dashboard.cards.portfolioRevenue')} value={fmtRub(data?.portfolioRevenue ?? null)}
        description={data?.portfolioRevenue == null ? t('dashboard.cards.unavailable.revenue') : undefined}
        icon={<TrendingUp className="h-4 w-4" />} />
      <MetricCard
        compact
        label={t('dashboard.cards.revenueGrowth')}
        description={data?.revenueGrowth == null ? t('dashboard.cards.unavailable.growth') : undefined}
        value={
          data?.revenueGrowth == null ? (
            '—'
          ) : (
            <span className={data.revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}>{fmtSignedPct(data.revenueGrowth * 100)}</span>
          )
        }
        icon={<TrendingUp className="h-4 w-4" />}
      />
      <MetricCard compact label={t('dashboard.cards.onTrack')} value={onTrackPct == null ? '—' : `${onTrackPct}%`}
        description={onTrackPct == null ? t('dashboard.cards.unavailable.onTrack') : undefined}
        icon={<CircleCheck className="h-4 w-4" />} />
      <MetricCard compact label={t('dashboard.cards.atRisk')} value={String(data?.companiesAtRisk ?? 0)} icon={<AlertTriangle className="h-4 w-4" />} />
      <MetricCard
        compact
        label={t('dashboard.cards.avgRunway')}
        description={data?.avgRunway == null ? t('dashboard.cards.unavailable.runway') : undefined}
        value={data?.avgRunway != null ? t('overview.kpi.runwayMonths', { value: Number(data.avgRunway.toFixed(1)) }) : '—'}
        icon={<CalendarClock className="h-4 w-4" />}
      />
    </div>
  )
}
