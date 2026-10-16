import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MetricUpsert, UnitEconomicsMetricSource, UnitEconomicsResponse, ReviewComment, ReviewCommentCreate, ReviewCorrection, ReviewCorrectionCreate } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricHelp } from '@/components/shared/metric-help'
import { fmtPct, fmtRub, formatMonthLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { UnitEconomicsSourceEditor } from './UnitEconomicsSourceEditor'
import { CommentButton } from './CommentButton'
import { CorrectionButton } from './CorrectionButton'

const fmtNum = (v: number | null | undefined, digits = 2) =>
  v == null ? '—' : v.toFixed(digits)

interface UnitEconomicsTabProps {
  data?: UnitEconomicsResponse
  isLoading?: boolean
  canEdit?: boolean
  metricLabel?: (key: string, fallback: string) => string
  onSaveSource?: (data: MetricUpsert) => Promise<unknown>
  onDeleteSource?: (id: string) => Promise<unknown>
  isSaving?: boolean
  isDeleting?: boolean
  comments?: ReviewComment[]
  canCreateComment?: boolean
  onCreateComment?: (data: ReviewCommentCreate) => Promise<unknown>
  commentState?: { loading?: boolean; error?: boolean; onRetry?: () => void }
  corrections?: ReviewCorrection[]
  canCreateCorrection?: boolean
  onCreateCorrection?: (data: ReviewCorrectionCreate) => Promise<unknown>
  correctionState?: { loading?: boolean; error?: boolean; onRetry?: () => void }
}

export function UnitEconomicsTab({ data, isLoading, canEdit = false, metricLabel, onSaveSource, onDeleteSource, isSaving, isDeleting, comments = [], canCreateComment = false, onCreateComment, commentState, corrections = [], canCreateCorrection = false, onCreateCorrection, correctionState }: UnitEconomicsTabProps) {
  const { t, i18n } = useTranslation()
  const [editingSource, setEditingSource] = useState<UnitEconomicsMetricSource | null>(null)

  if (isLoading) {
    return (
      <Card className="border bg-card">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-40 mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card className="border bg-card">
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">
            {t('company.unit.empty')}
          </p>
        </CardContent>
      </Card>
    )
  }

  const fmtMonths = (v: number | null | undefined) =>
    v == null ? '—' : t('company.unit.monthsShort', { value: v.toFixed(1) })

  const stats = [
    { key: 'gross_margin', label: t('company.unit.grossMargin'), description: t('company.unit.grossMarginHelp'), value: fmtPct(data.grossMargin), ok: null },
    {
      key: 'ltv_cac', label: t('company.unit.ratio'),
      description: t('company.unit.ratioHelp'),
      value: fmtNum(data.ltvCac),
      ok: data.ltvCac == null ? null : data.ltvCac >= 3,
    },
    {
      key: 'magic_number', label: t('company.unit.magicNumber'),
      description: t('company.unit.magicHelp'),
      value: fmtNum(data.magicNumber),
      ok: data.magicNumber == null ? null : data.magicNumber >= 1,
    },
    {
      key: 'runway_months', label: t('company.unit.runway'),
      description: t('company.unit.runwayHelp'),
      value: fmtMonths(data.runwayMonths),
      ok: data.runwayMonths == null ? null : data.runwayMonths >= 6,
    },
    {
      key: 'payback_period', label: t('company.unit.payback'),
      description: t('company.unit.paybackHelp'),
      value: fmtMonths(data.paybackPeriod),
      ok: data.paybackPeriod == null ? null : data.paybackPeriod <= 12,
    },
    {
      key: 'romi', label: t('company.unit.romi'),
      description: t('company.unit.romiHelp'),
      value: fmtPct(data.romi),
      ok: data.romi == null ? null : data.romi >= 0,
    },
    {
      key: 'churn', label: t('company.unit.churn'),
      value: fmtPct(data.churn),
      ok: data.churn == null ? null : data.churn <= 0.05,
      description: t('overview.metricHelp.churn'),
    },
  ]

  const retention = [
    { key: 'retention_m1', label: 'M1', value: data.retention.m1 },
    { key: 'retention_m3', label: 'M3', value: data.retention.m3 },
    { key: 'retention_m6', label: 'M6', value: data.retention.m6 },
    { key: 'retention_m12', label: 'M12', value: data.retention.m12 },
  ]
  const source = data.sourceMetric
  const indicatorValues: Record<string, number | null | undefined> = {
    gross_margin: data.grossMargin, ltv_cac: data.ltvCac, magic_number: data.magicNumber,
    runway_months: data.runwayMonths, payback_period: data.paybackPeriod, romi: data.romi,
    churn: data.churn, revenue: data.revenue, cac: data.cac, ltv: data.ltv,
    retention_m1: data.retention.m1, retention_m3: data.retention.m3,
    retention_m6: data.retention.m6, retention_m12: data.retention.m12,
  }
  const indicatorComment = (key: string, label: string) => {
    if (!onCreateComment) return null
    const target: Omit<ReviewCommentCreate, 'text'> = {
      target_type: 'unit_economics', indicator_key: key,
      ...(source ? { target_period: source.period, target_scenario: source.type } : {}),
    }
    const matching = comments.filter(comment => comment.indicatorKey === key &&
      (comment.targetPeriod ?? null) === (source?.period ?? null) &&
      (comment.targetScenario ?? null) === (source?.type ?? null))
    return <CommentButton label={label} target={target} comments={matching} canCreate={canCreateComment}
      onCreate={onCreateComment} {...commentState} />
  }
  const indicatorCorrection = (key: string, label: string) => {
    if (!onCreateCorrection) return null
    const target: Omit<ReviewCorrectionCreate, 'corrected_value' | 'reason'> = {
      target_type: 'unit_economics', indicator_key: key,
      ...(source ? { target_period: source.period, target_scenario: source.type } : {}),
    }
    return <CorrectionButton label={label} valueKey={key} currentValue={indicatorValues[key]}
      target={target} corrections={corrections.filter(item => item.indicatorKey === key)}
      canCreate={canCreateCorrection} onCreate={onCreateCorrection} {...correctionState} />
  }
  const editable = Boolean(canEdit && source && onSaveSource && onDeleteSource)
  const basic = [
    { key: 'revenue', label: t('company.unit.revenue'), value: fmtRub(data.revenue), sourceValue: true },
    { key: 'cac', label: t('company.unit.cac'), value: fmtRub(data.cac) },
    { key: 'ltv', label: t('company.unit.ltv'), value: fmtRub(data.ltv) },
    { key: 'churn', label: t('company.unit.churn'), value: fmtPct(data.churn) },
  ]
  const openEditor = () => { if (editable && source) setEditingSource(source) }

  return (
    <div className="space-y-6">
      <Card className="border bg-card">
        <CardContent className="p-5">
          <h3 className="font-semibold text-foreground mb-2">{t('company.unit.title')}</h3>
          <p className="text-sm text-muted-foreground mb-5">{t('company.unit.computedHint')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-1">{s.description ? (
                  <MetricHelp label={s.label} description={s.description} side="right" className="text-xs font-medium text-muted-foreground" />
                ) : (
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{s.label}</p>
                )}<span className="flex items-center">{indicatorComment(s.key, s.label)}{indicatorCorrection(s.key, s.label)}</span></div>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    s.ok === null
                      ? 'text-foreground'
                      : s.ok
                        ? 'text-success'
                        : 'text-destructive'
                  }`}
                >
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border bg-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">{t('company.unit.basic')}</h3>
            {source && <p className="mb-3 text-sm text-muted-foreground">{t('company.unit.source', {
              type: t(`common.${source.type}`), period: formatMonthLabel(source.period.slice(0, 7), i18n.language),
            })}</p>}
            <dl className="space-y-2 text-sm">
              {basic.map(({ key, label, value, sourceValue }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="flex shrink-0 items-center gap-1 text-foreground">
                    {editable && sourceValue ? (
                      <button type="button" aria-label={t('company.unit.editValue', { metric: label })}
                        className="cursor-pointer rounded px-1.5 py-1 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onDoubleClick={openEditor}
                        onClick={(event) => { if (event.detail === 0) openEditor() }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor() }
                        }}>{value}</button>
                    ) : value}{indicatorComment(key, label)}{indicatorCorrection(key, label)}
                  </dd>
                </div>
              ))}
            </dl>
            {editable && <div className="mt-4 space-y-2">
              <p className="text-xs text-muted-foreground">{t('company.unit.editHint')}</p>
              <Button type="button" variant="outline" className="whitespace-normal" onClick={openEditor}>{t('company.unit.editSource')}</Button>
            </div>}
          </CardContent>
        </Card>

        <Card className="border bg-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">{t('company.unit.retention')}</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              {retention.map((r) => (
                <div key={r.label} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">{r.label}{indicatorComment(r.key, r.label)}{indicatorCorrection(r.key, r.label)}</div>
                  <p className="text-lg font-semibold text-foreground mt-1">
                    {fmtPct(r.value)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.alerts.length > 0 && (
        <Card className="border bg-card">
          <CardContent className="p-5">
            <h3 className="font-semibold text-foreground mb-4">{t('company.unit.diagnostics')}</h3>
            <ul className="space-y-2 text-sm">
              {data.alerts.map((a, i) => (
                <li key={i} className="text-foreground">
                  {a}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {canEdit && editingSource && onSaveSource && onDeleteSource && (
        <UnitEconomicsSourceEditor source={editingSource} metricLabel={metricLabel}
          onSave={onSaveSource} onDelete={onDeleteSource} isSaving={isSaving} isDeleting={isDeleting}
          onClose={() => setEditingSource(null)} />
      )}
    </div>
  )
}
