import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Budget, BudgetUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MonthPicker } from '@/components/ui/month-picker'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Plus, ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react'
import { fmtPeriod, fmtRub } from '@/lib/format'

const fmtDevRub = (v: number) =>
  `${v >= 0 ? '+' : ''}${v.toLocaleString('ru-RU')} ₽`

const fmtDevPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`

type ArticleKey = 'marketing' | 'development' | 'fot' | 'gna'

interface BudgetTabProps {
  budgets: Budget[]
  canEdit: boolean
  onSubmit: (d: BudgetUpsert) => void
  onDelete?: (id: string) => void
  isPending: boolean
}

export function BudgetTab({
  budgets,
  canEdit,
  onSubmit,
  onDelete,
  isPending,
}: BudgetTabProps) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState({
    period: '',
    type: 'plan' as 'plan' | 'fact',
    marketing: '',
    development: '',
    fot: '',
    gna: '',
  })

  const ARTICLES: { key: ArticleKey; label: string }[] = [
    { key: 'marketing', label: t('company.budget.marketing') },
    { key: 'development', label: t('company.budget.development') },
    { key: 'fot', label: t('company.budget.fot') },
    { key: 'gna', label: t('company.budget.gna') },
  ]

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
    <Card className="border bg-card">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-foreground">{t('company.budget.title')}</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
              <Plus className="w-4 h-4 mr-2" />
              {t('company.budget.add')}
            </Button>
          )}
        </div>

        {showForm && canEdit && (
          <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
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
                min="0"
                placeholder={t('common.marketingRub')}
                aria-label={t('common.marketingRub')}
                value={form.marketing}
                onChange={(e) => setForm({ ...form, marketing: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder={t('company.budget.developmentRub')}
                aria-label={t('company.budget.developmentRub')}
                value={form.development}
                onChange={(e) =>
                  setForm({ ...form, development: e.target.value })
                }
              />
              <Input
                type="number"
                min="0"
                placeholder={t('company.budget.fotRub')}
                aria-label={t('company.budget.fotRub')}
                value={form.fot}
                onChange={(e) => setForm({ ...form, fot: e.target.value })}
              />
              <Input
                type="number"
                min="0"
                placeholder={t('company.budget.gnaRub')}
                aria-label={t('company.budget.gnaRub')}
                value={form.gna}
                onChange={(e) => setForm({ ...form, gna: e.target.value })}
              />
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.period')}</TableHead>
              <TableHead>{t('company.budget.article')}</TableHead>
              <TableHead className="text-right">{t('common.plan')}</TableHead>
              <TableHead className="text-right">{t('common.fact')}</TableHead>
              <TableHead className="text-right">{t('company.budget.deviation')}</TableHead>
              {canEdit && onDelete && (
                <TableHead className="w-12" aria-label={t('common.actions')} />
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
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
                  <TableRow key={`${period}-${article.key}`}>
                    {i === 0 && (
                      <TableCell
                        rowSpan={ARTICLES.length}
                        className="align-top font-medium text-foreground"
                      >
                        {fmtPeriod(period)}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">{article.label}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtRub(planVal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">
                      {fmtRub(factVal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dev == null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 font-medium ${
                            positive ? 'text-success' : 'text-destructive'
                          }`}
                        >
                          {positive ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4" />
                          )}
                          <span>{fmtDevRub(dev)}</span>
                          {devPct != null && <span>{fmtDevPct(devPct)}</span>}
                        </span>
                      )}
                    </TableCell>
                    {i === 0 && canEdit && onDelete && (
                      <TableCell rowSpan={ARTICLES.length} className="align-top text-right">
                        <div className="flex flex-col items-end gap-1">
                          {[entry.plan, entry.fact].map((budget) =>
                            budget ? (
                              <Button
                                key={budget.id}
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label={t('company.budget.delete')}
                                onClick={() => setDeleteId(budget.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null,
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            })}
            {periods.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5 + (canEdit && onDelete ? 1 : 0)}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t('company.budget.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
