import { useState } from 'react'
import type { Cohort, CohortUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'
import { fmtPct, fmtPeriod, fmtRub } from '@/lib/format'

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

const RETENTION_KEYS: Array<keyof Cohort> = [
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
]

const retentionAt = (c: Cohort, i: number): number =>
  c[RETENTION_KEYS[i]] as number

// Heatmap: green >70%, amber 50–70%, red <50% (kogor.md:156-159)
const heatClass = (v: number): string => {
  if (v > 0.7) return 'bg-emerald-500/20 text-emerald-700'
  if (v >= 0.5) return 'bg-amber-500/20 text-amber-700'
  return 'bg-red-500/20 text-red-700'
}

const activeUsers = (c: Cohort): number =>
  Math.round(c.size * retentionAt(c, 11))

const cacValue = (c: Cohort): string => {
  if (c.marketingSpend == null || c.size <= 0) return '—'
  return fmtRub(c.marketingSpend / c.size)
}

interface CohortsTabProps {
  cohorts: Cohort[]
  canEdit: boolean
  onSubmit: (d: CohortUpsert) => void
  isPending: boolean
}

export function CohortsTab({
  cohorts,
  canEdit,
  onSubmit,
  isPending,
}: CohortsTabProps) {
  const [showForm, setShowForm] = useState(false)
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
    form.size !== '' &&
    form.retention.every((r) => r !== '')

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
      retention_m1: Number(form.retention[0]) / 100,
      retention_m2: Number(form.retention[1]) / 100,
      retention_m3: Number(form.retention[2]) / 100,
      retention_m4: Number(form.retention[3]) / 100,
      retention_m5: Number(form.retention[4]) / 100,
      retention_m6: Number(form.retention[5]) / 100,
      retention_m7: Number(form.retention[6]) / 100,
      retention_m8: Number(form.retention[7]) / 100,
      retention_m9: Number(form.retention[8]) / 100,
      retention_m10: Number(form.retention[9]) / 100,
      retention_m11: Number(form.retention[10]) / 100,
      retention_m12: Number(form.retention[11]) / 100,
    }
    if (form.marketing !== '') payload.marketing_spend = Number(form.marketing)
    onSubmit(payload)
  }

  const colCount = 3 + MONTHS.length + 2

  return (
    <Card className="border bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">
            Когортный анализ — матрица удержания M1–M12
          </h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить когорту
            </Button>
          )}
        </div>

        {showForm && canEdit && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <Input
                type="month"
                aria-label="Период"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
              />
              <select
                aria-label="Тип"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as 'plan' | 'fact' })
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="plan">План</option>
                <option value="fact">Факт</option>
              </select>
              <Input
                type="number"
                min="1"
                step="1"
                placeholder="Размер когорты"
                aria-label="Размер когорты"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Маркетинг (₽)"
                aria-label="Маркетинг (₽)"
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
                {isPending ? 'Сохранение...' : 'Сохранить'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                Отмена
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">
                  Когорта
                </th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">
                  Тип
                </th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">
                  Размер
                </th>
                {MONTHS.map((m) => (
                  <th
                    key={m}
                    className="text-center font-medium px-2 py-3 whitespace-nowrap"
                  >
                    M{m}
                  </th>
                ))}
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">
                  Активные
                </th>
                <th className="text-left font-medium px-3 py-3 whitespace-nowrap">
                  CAC
                </th>
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => {
                const entry = byPeriod.get(period)!
                const types = (['plan', 'fact'] as const).filter((t) => entry[t])
                return types.map((type, i) => {
                  const c = entry[type]!
                  return (
                    <tr
                      key={`${period}-${type}`}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                    >
                      {i === 0 && (
                        <td
                          rowSpan={types.length}
                          className="px-3 py-3 font-medium text-foreground align-top"
                        >
                          {fmtPeriod(period)}
                        </td>
                      )}
                      <td
                        className={`px-3 py-3 whitespace-nowrap ${
                          type === 'fact' ? 'text-foreground' : 'text-muted-foreground'
                        }`}
                      >
                        {type === 'plan' ? 'План' : 'Факт'}
                      </td>
                      <td className="px-3 py-3 text-foreground">{c.size}</td>
                      {MONTHS.map((m, idx) => {
                        const v = retentionAt(c, idx)
                        return (
                          <td key={m} className="px-2 py-3 text-center">
                            <span
                              title={`M${m}: ${fmtPct(v)} · ${Math.round(
                                c.size * v
                              )} чел`}
                              className={`inline-block rounded px-2 py-1 text-xs font-medium ${heatClass(
                                v
                              )}`}
                            >
                              {fmtPct(v)}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-3 py-3 text-foreground">
                        {activeUsers(c)}
                      </td>
                      <td className="px-3 py-3 text-foreground">{cacValue(c)}</td>
                    </tr>
                  )
                })
              })}
              {periods.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    Когорты ещё не добавлены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
