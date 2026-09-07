import { useTranslation } from 'react-i18next'
import type { BusinessHealthResponse } from '@/types/api'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'

const statusTone: Record<string, StatusTone> = {
  healthy: 'success',
  attention: 'warning',
  critical: 'danger',
  no_data: 'neutral',
}

const directionGlyph: Record<string, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
  unknown: '—',
}

const signalStatusClass: Record<string, string> = {
  good: 'text-success',
  bad: 'text-danger',
  neutral: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
}

export function BusinessHealth({ data }: { data: BusinessHealthResponse | undefined }) {
  const { t } = useTranslation()

  if (!data) return null

  const statusLabel = (() => {
    switch (data.status) {
      case 'healthy':
        return t('overview.health.healthy')
      case 'attention':
        return t('overview.health.attention')
      case 'critical':
        return t('overview.health.critical')
      default:
        return t('overview.health.noData')
    }
  })()

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <StatusBadge tone={statusTone[data.status] ?? 'neutral'}>{statusLabel}</StatusBadge>
      </div>
      {data.signals.length > 0 && (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {data.signals.map((s) => (
            <li
              key={s.key}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground">{t(`overview.health.signal.${s.key}`)}</span>
              <span className={cn('font-medium tabular-nums', signalStatusClass[s.status] ?? 'text-muted-foreground')}>
                {directionGlyph[s.direction] ?? '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
