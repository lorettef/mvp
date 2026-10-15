import { useTranslation } from 'react-i18next'
import type { Cohort } from '@/types/api'
import { fmtPct } from '@/lib/format'
import { retentionAt } from '@/lib/companyOverview'

/** Shared age/colour/tooltip presentation used by the source table and overview. */
export function CohortRetentionCell({ cohort,index }: { cohort:Cohort; index:number }) {
  const { t } = useTranslation()
  const value = retentionAt(cohort,index)
  if (value === null) return <span className="text-muted-foreground">—</span>
  const color = value > .7 ? 'bg-success/15 text-success' : value >= .5 ? 'bg-warning/15 text-warning' : 'bg-danger/15 text-danger'
  return <span title={t('company.cohorts.cellTitle',{month:index+1,retention:fmtPct(value),users:Math.round(cohort.size*value)})}
    className={`inline-block rounded-sm px-2 py-1 text-xs font-medium ${color}`}>{fmtPct(value)}</span>
}
