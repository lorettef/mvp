import { useTranslation } from 'react-i18next'
import { Archive, ArrowUpRight, Sparkles, TriangleAlert } from 'lucide-react'
import type { CompanyStatusItem } from '@/types/api'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { fmtRub, fmtSignedPct } from '@/lib/format'

const healthTone: Record<string, StatusTone> = {
  healthy: 'success',
  attention: 'warning',
  critical: 'danger',
  no_data: 'neutral',
  unknown: 'neutral',
}

const statusTone: Record<string, StatusTone> = {
  on_track: 'success',
  behind: 'danger',
  no_plan: 'neutral',
  no_data: 'neutral',
}

export function FundCompaniesTable({
  companies,
  industryLabel,
  canArchive,
  onOpen,
  onAiAnalysis,
  onArchive,
}: {
  companies: CompanyStatusItem[]
  industryLabel: (slug: string | null) => string
  canArchive: boolean
  onOpen: (id: string) => void
  onAiAnalysis: (id: string) => void
  onArchive: (id: string) => void
}) {
  const { t } = useTranslation()

  const healthLabel = (h: string) => {
    switch (h) {
      case 'healthy':
        return t('overview.health.healthy')
      case 'attention':
        return t('overview.health.attention')
      case 'critical':
        return t('overview.health.critical')
      default:
        return t('dashboard.status.noData')
    }
  }

  const statusLabel = (s: CompanyStatusItem['status']) => {
    switch (s) {
      case 'on_track':
        return t('dashboard.status.onTrack')
      case 'behind':
        return t('dashboard.status.behind')
      case 'no_plan':
        return t('dashboard.status.noPlan')
      default:
        return t('dashboard.status.noData')
    }
  }

  const growth = (c: CompanyStatusItem) =>
    c.revenueGrowth == null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className={c.revenueGrowth >= 0 ? 'text-success' : 'text-destructive'}>
        {fmtSignedPct(c.revenueGrowth * 100)}
      </span>
    )

  const badges = (c: CompanyStatusItem) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <StatusBadge tone={healthTone[c.health] ?? 'neutral'}>{healthLabel(c.health)}</StatusBadge>
      <StatusBadge tone={statusTone[c.status]} dot={false}>{statusLabel(c.status)}</StatusBadge>
    </div>
  )

  const attention = (c: CompanyStatusItem) =>
    c.attention.length === 0 ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span
        title={c.attention.map((a) => a.label).join(' · ')}
        className="inline-flex items-center gap-1 text-xs text-warning"
      >
        <TriangleAlert className="h-3.5 w-3.5" />
        {c.attention.length}
      </span>
    )

  const actions = (c: CompanyStatusItem) => (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={() => onOpen(c.id)} aria-label={t('dashboard.table.open')}>
        <ArrowUpRight className="h-4 w-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onAiAnalysis(c.id)} aria-label={t('dashboard.table.aiAnalysis')}>
        <Sparkles className="h-4 w-4" />
      </Button>
      {canArchive && (
        <Button size="sm" variant="ghost" onClick={() => onArchive(c.id)} aria-label={t('dashboard.lifecycle.archive')}>
          <Archive className="h-4 w-4" />
        </Button>
      )}
    </div>
  )

  return (
    <>
      {/* Desktop / tablet: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-3 py-2 text-left font-medium">{t('dashboard.table.company')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('dashboard.table.sphere')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('dashboard.table.revenueFact')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('dashboard.table.growth')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('overview.financial.runway')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('dashboard.table.health')}</th>
              <th className="px-3 py-2 text-left font-medium">{t('dashboard.table.attention')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-border/50 transition-colors hover:bg-muted/30 last:border-0">
                <td className="px-3 py-3">
                  <button
                    type="button"
                    onClick={() => onOpen(c.id)}
                    className="flex items-center gap-2 text-left font-medium text-foreground hover:underline"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                      {c.name[0]?.toUpperCase()}
                    </span>
                    <span className="min-w-0 truncate">{c.name}</span>
                  </button>
                  {c.lastUpdate && (
                    <p className="mt-0.5 pl-9 text-xs text-muted-foreground">
                      {t('dashboard.table.lastUpdate')}: {c.lastUpdate.slice(0, 7)}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 text-muted-foreground">{industryLabel(c.industry)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-foreground">{fmtRub(c.latestRevenue)}</td>
                <td className="px-3 py-3 text-right tabular-nums">{growth(c)}</td>
                <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                  {c.runwayMonths != null ? t('overview.kpi.runwayMonths', { value: c.runwayMonths }) : '—'}
                </td>
                <td className="px-3 py-3">{badges(c)}</td>
                <td className="px-3 py-3">{attention(c)}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">{actions(c)}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="divide-y divide-border/60 sm:hidden">
        {companies.map((c) => (
          <div key={c.id} className="space-y-3 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                onClick={() => onOpen(c.id)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                  {c.name[0]?.toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-foreground">{c.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{industryLabel(c.industry)}</span>
                </span>
              </button>
              <div className="shrink-0">{actions(c)}</div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.table.revenueFact')}</p>
                <p className="tabular-nums text-foreground">{fmtRub(c.latestRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.table.growth')}</p>
                <p className="tabular-nums">{growth(c)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('overview.financial.runway')}</p>
                <p className="tabular-nums text-muted-foreground">
                  {c.runwayMonths != null ? t('overview.kpi.runwayMonths', { value: c.runwayMonths }) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('dashboard.table.attention')}</p>
                <p>{attention(c)}</p>
              </div>
            </div>

            <div>{badges(c)}</div>
          </div>
        ))}
      </div>
    </>
  )
}
