import { useState } from 'react'
import type { Budget, BudgetUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ArrowUpRight, ArrowDownRight } from 'lucide-react'

const fmtRub = (v: number | null | undefined) =>
  v == null ? '—' : `₽${v.toLocaleString('ru-RU')}`

const fmtPeriod = (period: string) => (period ? period.slice(0, 7) : '—')

const fmtDevRub = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toLocaleString('ru-RU')} ₽`

const fmtDevPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

type ArticleKey = 'marketing' | 'development' | 'fot' | 'gna'

const ARTICLES: { key: ArticleKey; label: string }[] = [
  { key: 'marketing', label: 'Маркетинг' },
  { key: 'development', label: 'Разработка' },
  { key: 'fot', label: 'ФОТ' },
  { key: 'gna', label: 'G&A' },
]

interface BudgetTabProps {
  budgets: Budget[]
  canEdit: boolean
  onSubmit: (d: BudgetUpsert) => void
  isPending: boolean
}

export function BudgetTab({
  budgets,
  canEdit,
  onSubmit,
  isPending,
}: BudgetTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    period: '',
    type: 'plan' as 'plan' | 'fact',
    marketing: '',
    development: '',
    fot: '',
    gna: '',
  })

  const byPeriod = new Map<string, { plan?: Budget; fact?: Budget }>()
  for (const b of budgets) {
    if (!byPeriod.has(b.period)) byPeriod.set(b.period, {})
    const entry = byPeriod.get(b.period)!
    entry[b.type] = b
  }
  const periods = Array.from(byPeriod.keys()).sort((a, b) =>
    b.localeCompare(a)
  )

  const valid =
    form.period !== '' &&
    form.marketing !== '' &&
    form.development !== '' &&
    form.fot !== '' &&
    form.gna !== ''

  const handleSubmit = () => {
    onSubmit({
      period: `${form.period}-01`,
      type: form.type,
      marketing: Number(form.marketing),
      development: Number(form.development),
      fot: Number(form.fot),
      gna: Number(form.gna),
    })
  }

  return (
    <Card className="border bg-card/50">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">Бюджет — План vs Факт</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить бюджет
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
                min="0"
                placeholder="Маркетинг (₽)"
                aria-label="Маркетинг (₽)"
                value={form.marketing}
                onChange={(e) => setForm({ ...form, marketing: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder="Разработка (₽)"
                aria-label="Разработка (₽)"
                value={form.development}
                onChange={(e) =>
                  setForm({ ...form, development: e.target.value })
                }
              />
              <Input
                type="number"
                min="0"
                placeholder="ФОТ (₽)"
                aria-label="ФОТ (₽)"
                value={form.fot}
                onChange={(e) => setForm({ ...form, fot: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder="G&A (₽)"
                aria-label="G&A (₽)"
                value={form.gna}
                onChange={(e) => setForm({ ...form, gna: e.target.value })}
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
              <th className="text-left font-medium px-4 py-3">Статья</th>
              <th className="text-left font-medium px-4 py-3">План</th>
              <th className="text-left font-medium px-4 py-3">Факт</th>
              <th className="text-left font-medium px-4 py-3">Отклонение</th>
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => {
              const entry = byPeriod.get(period)!
              return ARTICLES.map((article, i) => {
                const planVal = entry.plan?.[article.key]
                const factVal = entry.fact?.[article.key]
                let dev: number | null = null
                let devPct: number | null = null
                if (planVal != null && factVal != null) {
                  dev = factVal - planVal
                  devPct = planVal !== 0 ? (dev / planVal) * 100 : null
                }
                const positive = dev != null && dev >= 0
                return (
                  <tr
                    key={`${period}-${article.key}`}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    {i === 0 && (
                      <td
                        rowSpan={ARTICLES.length}
                        className="px-4 py-3 font-medium text-foreground align-top"
                      >
                        {fmtPeriod(period)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-muted-foreground">
                      {article.label}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtRub(planVal)}
                    </td>
                    <td className="px-4 py-3 text-foreground">{fmtRub(factVal)}</td>
                    <td className="px-4 py-3">
                      {dev == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            positive ? 'text-emerald-500' : 'text-destructive'
                          }`}
                        >
                          {positive ? (
                            <ArrowUpRight className="w-4 h-4" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4" />
                          )}
                          <span>{fmtDevRub(dev)}</span>
                          {devPct != null && <span>{fmtDevPct(devPct)}</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            })}
            {periods.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  Бюджет ещё не добавлен.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
