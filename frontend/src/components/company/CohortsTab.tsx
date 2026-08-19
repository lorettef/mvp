import { useState } from 'react'
import type { Cohort, CohortUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus } from 'lucide-react'

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${(v * 100).toFixed(1)}%`

const fmtPeriod = (period: string) => (period ? period.slice(0, 7) : '—')

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
    m1: '',
    m3: '',
    m6: '',
    m12: '',
  })

  const byPeriod = new Map<string, { plan?: Cohort; fact?: Cohort }>()
  for (const c of cohorts) {
    if (!byPeriod.has(c.period)) byPeriod.set(c.period, {})
    const entry = byPeriod.get(c.period)!
    entry[c.type] = c
  }
  const rows = Array.from(byPeriod.entries()).sort((a, b) =>
    b[0].localeCompare(a[0])
  )

  const valid =
    form.period !== '' &&
    form.m1 !== '' &&
    form.m3 !== '' &&
    form.m6 !== '' &&
    form.m12 !== ''

  const handleSubmit = () => {
    onSubmit({
      period: `${form.period}-01`,
      type: form.type,
      retention_m1: Number(form.m1) / 100,
      retention_m3: Number(form.m3) / 100,
      retention_m6: Number(form.m6) / 100,
      retention_m12: Number(form.m12) / 100,
    })
  }

  return (
    <Card className="border bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">
            Когортный анализ — План vs Факт
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
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
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
                step="0.1"
                min="0"
                max="100"
                placeholder="M1 (%)"
                aria-label="M1 (%)"
                value={form.m1}
                onChange={(e) => setForm({ ...form, m1: e.target.value })}
              />
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="M3 (%)"
                aria-label="M3 (%)"
                value={form.m3}
                onChange={(e) => setForm({ ...form, m3: e.target.value })}
              />
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="M6 (%)"
                aria-label="M6 (%)"
                value={form.m6}
                onChange={(e) => setForm({ ...form, m6: e.target.value })}
              />
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="M12 (%)"
                aria-label="M12 (%)"
                value={form.m12}
                onChange={(e) => setForm({ ...form, m12: e.target.value })}
              />
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

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="text-left font-medium px-4 py-3">Период</th>
              <th className="text-left font-medium px-4 py-3">M1 план</th>
              <th className="text-left font-medium px-4 py-3">M1 факт</th>
              <th className="text-left font-medium px-4 py-3">M3 план</th>
              <th className="text-left font-medium px-4 py-3">M3 факт</th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                M6 план
              </th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                M6 факт
              </th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                M12 план
              </th>
              <th className="text-left font-medium px-4 py-3 hidden sm:table-cell">
                M12 факт
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([period, entry]) => (
              <tr
                key={period}
                className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground">
                  {fmtPeriod(period)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {fmtPct(entry.plan?.retentionM1)}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {fmtPct(entry.fact?.retentionM1)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {fmtPct(entry.plan?.retentionM3)}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {fmtPct(entry.fact?.retentionM3)}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {fmtPct(entry.plan?.retentionM6)}
                </td>
                <td className="px-4 py-3 text-foreground hidden sm:table-cell">
                  {fmtPct(entry.fact?.retentionM6)}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {fmtPct(entry.plan?.retentionM12)}
                </td>
                <td className="px-4 py-3 text-foreground hidden sm:table-cell">
                  {fmtPct(entry.fact?.retentionM12)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Когорты ещё не добавлены.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
