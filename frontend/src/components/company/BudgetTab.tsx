import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import type { Budget, BudgetSource, BudgetUpsert } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { fmtRub, formatMonthLabel } from '@/lib/format'
import { BudgetSourceEditor } from './BudgetSourceEditor'
import { FinanceMatrix, FinanceSourceValue } from './FinanceMatrix'

type Article = 'marketing' | 'development' | 'fot' | 'gna'
interface Props {
  budgets: Budget[]
  canEdit: boolean
  onSubmit: (data: BudgetUpsert) => Promise<unknown>
  onDelete?: (id: string) => Promise<unknown>
}
interface Editing { source?: BudgetSource; period: string; type: 'plan' | 'fact'; chooseIdentity?: boolean }

export function BudgetTab({ budgets, canEdit, onSubmit, onDelete }: Props) {
  const { t, i18n } = useTranslation()
  const selectorId = useId()
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const byPeriod = new Map<string, Partial<Record<'plan' | 'fact', Budget>>>()
  for (const budget of budgets) {
    const pair = byPeriod.get(budget.period) ?? {}
    pair[budget.type] = budget
    byPeriod.set(budget.period, pair)
  }
  // Same horizon as P&L: latest 12 data periods, presented chronologically.
  const periods = [...byPeriod.keys()].sort().slice(-12)
  const selected = selectedMonth && periods.includes(selectedMonth) ? selectedMonth : periods[periods.length - 1]
  const rows = (['marketing', 'development', 'fot', 'gna'] as Article[]).map((key) => ({ key, label: t(`company.budget.${key}`) }))
  const getSource = (period: string, type: 'plan' | 'fact') => byPeriod.get(period)?.[type]
  const open = (period: string, type: 'plan' | 'fact') => {
    if (canEdit) setEditing({ source: getSource(period, type), period, type })
  }
  const matrix = (visiblePeriods: string[], mobile: boolean) => <FinanceMatrix
    periods={visiblePeriods} rows={rows} mobile={mobile} columnLabel={t('company.budget.article')}
    tableLabel={t(mobile ? 'company.budget.mobileMatrix' : 'company.budget.matrix')}
    renderCell={(row, period, type, isMobile) => {
      const source = getSource(period, type)
      return <FinanceSourceValue mobile={isMobile} missing={!source}
        label={t(source ? 'company.budget.editCell' : 'company.budget.createCell', { article: row.label, period: formatMonthLabel(period.slice(0, 7), i18n.language), type: t(`common.${type}`) })}
        actionLabel={t(source ? 'company.pnl.editAction' : 'company.budget.createAction')}
        onOpen={canEdit ? () => open(period, type) : undefined}>
        {fmtRub(source?.[row.key])}
      </FinanceSourceValue>
    }}
  />

  return <Card className="min-w-0 max-w-full border bg-card">
    <CardContent className="min-w-0 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-foreground">{t('company.budget.title')}</h3>
        {canEdit && <Button type="button" size="sm" variant="outline" onClick={() => setEditing({ period: '', type: 'plan', chooseIdentity: true })}>
          <Plus className="mr-2 h-4 w-4" />{t('company.budget.add')}
        </Button>}
      </div>
      {canEdit && <p className="mb-3 text-xs text-muted-foreground">{t('company.budget.editHint')}</p>}
      {!periods.length ? <p className="py-6 text-center text-sm text-muted-foreground">{t('company.budget.empty')}</p> : <>
        <div className="hidden min-w-0 max-w-full overflow-x-auto md:block" data-testid="budget-desktop">{matrix(periods, false)}</div>
        <div className="md:hidden" data-testid="budget-mobile">
          <label htmlFor={selectorId} className="mb-1 block text-sm font-medium">{t('common.period')}</label>
          <select id={selectorId} className="mb-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={selected} onChange={(event) => setSelectedMonth(event.target.value)}>
            {periods.map((period) => <option key={period} value={period}>{formatMonthLabel(period.slice(0, 7), i18n.language)}</option>)}
          </select>
          {matrix([selected], true)}
        </div>
      </>}
    </CardContent>
    {canEdit && editing && <BudgetSourceEditor
      source={editing.source} initialPeriod={editing.period} initialType={editing.type} chooseIdentity={editing.chooseIdentity}
      getSource={getSource} onDelete={onDelete} onClose={() => setEditing(null)}
      onSave={async (data) => { await onSubmit(data); setSelectedMonth(data.period) }}
    />}
  </Card>
}
