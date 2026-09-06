import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Cohort, CohortUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MonthPicker } from '@/components/ui/month-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, Trash2 } from 'lucide-react'
import { fmtPct, fmtPeriod, fmtRub } from '@/lib/format'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const RETENTION_KEYS = [
  'retentionM1',
  'retentionM2',
  'retentionM3',
  'retentionM4',
  'retentionM5',
  'retentionM6',
  'retentionM7',
  'retentionM8',
  'retentionM9',
  'retentionM10',
  'retentionM11',
  'retentionM12',
 ] as const

const retentionAt = (c: Cohort, i: number): number | null => {
  const key = RETENTION_KEYS[i]
  return key === undefined ? null : c[key]
}

// Heatmap: green >70%, amber 50–70%, red <50% (kogor.md:156-159)
const heatClass = (v: number): string => {
  if (v > 0.7) return 'bg-success/15 text-success'
  if (v >= 0.5) return 'bg-warning/15 text-warning'
  return 'bg-danger/15 text-danger'
}

const activeUsers = (c: Cohort): number | null => {
  const retention = retentionAt(c, 11)
  return retention == null ? null : Math.round(c.size * retention)
}

const retentionValue = (value: string): number | null =>
  value === '' ? null : Number(value) / 100

const cacValue = (c: Cohort): string => {
  if (c.marketingSpend == null || c.size <= 0) return '—'
  return fmtRub(c.marketingSpend / c.size)
}

interface CohortsTabProps {
  cohorts: Cohort[]
  canEdit: boolean
  onSubmit: (d: CohortUpsert) => void
  onDelete?: (id: string) => void
  isPending: boolean
}

export function CohortsTab({
  cohorts,
  canEdit,
  onSubmit,
  onDelete,
  isPending,
}: CohortsTabProps) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    period: '',
    type: 'plan' as 'plan' | 'fact',
    size: '',
    marketing: '',
    retention: Array<string>(12).fill(''),
  })

  const byPeriod = new Map<string, { plan?: Cohort; fact?: Cohort }>()
  for (const c of cohorts) {
    if (!byPeriod.has(c.period)) byPeriod.set(c.period, {})
    const entry = byPeriod.get(c.period)!
    entry[c.type] = c
  }
  const periods = Array.from(byPeriod.keys()).sort((a, b) =>
    b.localeCompare(a)
  )

  const valid =
    form.period !== '' &&
    form.size !== ''

  const setRetention = (i: number, value: string) => {
    const next = [...form.retention]
    next[i] = value
    setForm({ ...form, retention: next })
  }

  const handleSubmit = () => {
    const payload: CohortUpsert = {
      period: `${form.period}-01`,
      type: form.type,
      size: Number(form.size),
      retention_m1: retentionValue(form.retention[0]),
      retention_m2: retentionValue(form.retention[1]),
      retention_m3: retentionValue(form.retention[2]),
      retention_m4: retentionValue(form.retention[3]),
      retention_m5: retentionValue(form.retention[4]),
      retention_m6: retentionValue(form.retention[5]),
      retention_m7: retentionValue(form.retention[6]),
      retention_m8: retentionValue(form.retention[7]),
      retention_m9: retentionValue(form.retention[8]),
      retention_m10: retentionValue(form.retention[9]),
      retention_m11: retentionValue(form.retention[10]),
      retention_m12: retentionValue(form.retention[11]),
    }
    if (form.marketing !== '') payload.marketing_spend = Number(form.marketing)
    onSubmit(payload)
  }

  const colCount = 3 + MONTHS.length + 2 + (canEdit && onDelete ? 1 : 0)

  return (
    <Card className="border bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">
            {t('company.cohorts.title')}
          </h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('company.cohorts.add')}
            </Button>
          )}
        </div>

        {showForm && canEdit && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <MonthPicker
                aria-label={t('common.period')}
                value={form.period}
                onChange={(period) => setForm({ ...form, period })}
              />
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as 'plan' | 'fact' })}
              >
                <SelectTrigger aria-label={t('common.type')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="plan">{t('common.plan')}</SelectItem>
                  <SelectItem value="fact">{t('common.fact')}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder={t('company.cohorts.size')}
                aria-label={t('company.cohorts.size')}
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={t('common.marketingRub')}
                aria-label={t('common.marketingRub')}
                value={form.marketing}
                onChange={(e) => setForm({ ...form, marketing: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {MONTHS.map((m) => (
                <Input
                  key={m}
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder={`M${m} (%)`}
                  aria-label={`M${m} (%)`}
                  value={form.retention[m - 1]}
                  onChange={(e) => setRetention(m - 1, e.target.value)}
                />
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" disabled={!valid || isPending} onClick={handleSubmit}>
                {isPending ? t('common.saving') : t('common.save')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">{t('company.cohorts.cohort')}</TableHead>
                <TableHead className="whitespace-nowrap">{t('common.type')}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t('company.cohorts.sizeCol')}</TableHead>
                {MONTHS.map((m) => (
                  <TableHead key={m} className="text-center whitespace-nowrap">
                    M{m}
                  </TableHead>
                ))}
                <TableHead className="text-right whitespace-nowrap">{t('company.cohorts.active')}</TableHead>
                <TableHead className="text-right whitespace-nowrap">{t('company.cohorts.cac')}</TableHead>
                {canEdit && onDelete && (
                  <TableHead className="w-12" aria-label={t('common.actions')} />
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {periods.map((period) => {
                const entry = byPeriod.get(period)!
                const types = (['plan', 'fact'] as const).filter((t) => entry[t])
                return types.map((type, i) => {
                  const c = entry[type]!
                  return (
                    <TableRow key={`${period}-${type}`}>
                      {i === 0 && (
                        <TableCell
                          rowSpan={types.length}
                          className="align-top font-medium text-foreground"
                        >
                          {fmtPeriod(period)}
                        </TableCell>
                      )}
                      <TableCell
                        className={`whitespace-nowrap ${
                          type === 'fact' ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {type === 'plan' ? t('common.plan') : t('common.fact')}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{c.size}</TableCell>
                      {MONTHS.map((m, idx) => {
                        const v = retentionAt(c, idx)
                        return (
                          <TableCell key={m} className="text-center">
                            {v === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                title={t('company.cohorts.cellTitle', {
                                  month: m,
                                  retention: fmtPct(v),
                                  users: Math.round(c.size * v),
                                })}
                                className={`inline-block rounded-sm px-2 py-1 text-xs font-medium ${heatClass(v)}`}
                              >
                                {fmtPct(v)}
                              </span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right tabular-nums text-foreground">
                        {activeUsers(c) ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">{cacValue(c)}</TableCell>
                      {canEdit && onDelete && (
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t('company.cohorts.delete')}
                            onClick={() => setDeleteId(c.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })
              })}
              {periods.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={colCount}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {t('company.cohorts.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <ConfirmDialog
          open={deleteId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null)
          }}
          title={t('company.delete.title')}
          description={t('company.delete.description')}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          danger
          onConfirm={() => {
            if (deleteId !== null) onDelete?.(deleteId)
            setDeleteId(null)
          }}
        />
      </CardContent>
    </Card>
  )
}
