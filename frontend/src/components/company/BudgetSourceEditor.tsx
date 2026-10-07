import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BudgetSource, BudgetUpsert } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonthPicker } from '@/components/ui/month-picker'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { normalizeApiError } from '@/lib/apiError'
import { formatMonthLabel } from '@/lib/format'

interface Props {
  source?: BudgetSource
  initialPeriod?: string
  initialType?: 'plan' | 'fact'
  chooseIdentity?: boolean
  getSource?: (period: string, type: 'plan' | 'fact') => BudgetSource | undefined
  onSave: (data: BudgetUpsert) => Promise<unknown>
  onDelete?: (id: string) => Promise<unknown>
  onClose: () => void
}

const fields = ['marketing', 'development', 'fot', 'gna'] as const
type Field = typeof fields[number]
const initialValues = (source?: BudgetSource): Record<Field, string> => ({
  marketing: source ? String(source.marketing) : '',
  development: source ? String(source.development) : '',
  fot: source ? String(source.fot) : '',
  gna: source ? String(source.gna) : '',
})

/** One entire source record; P&L supplies a source, Budget also allows creation. */
export function BudgetSourceEditor({ source, initialPeriod = '', initialType = 'plan', chooseIdentity = false, getSource, onSave, onDelete, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const prefix = useId()
  const [periodValue, setPeriodValue] = useState(source?.period ?? initialPeriod)
  const [typeValue, setTypeValue] = useState(source?.type ?? initialType)
  const selectedSource = source ?? getSource?.(periodValue, typeValue)
  const [values, setValues] = useState(() => initialValues(selectedSource))
  const [errors, setErrors] = useState<Partial<Record<Field | 'period', string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const period = formatMonthLabel(periodValue.slice(0, 7), i18n.language)
  const type = t(`common.${typeValue}`)
  const identity = `${periodValue}:${typeValue}:${selectedSource?.id ?? ''}`
  const previousIdentity = useRef(identity)
  useEffect(() => {
    if (previousIdentity.current !== identity) {
      // Identity selection loads the entire existing record or clears every
      // field for creation; values never carry over to the other scenario.
      previousIdentity.current = identity
      setValues(initialValues(selectedSource))
      setErrors({})
      setApiError(null)
    }
  }, [identity, selectedSource])

  const submit = async (deleting: boolean) => {
    if (inFlight.current || (deleting && (!selectedSource || !onDelete))) return
    if (!deleting) {
      const nextErrors: typeof errors = {}
      if (!/^\d{4}-(0[1-9]|1[0-2])-01$/.test(periodValue)) nextErrors.period = t('company.unit.required')
      for (const key of fields) {
        if (!values[key].trim()) nextErrors[key] = t('company.unit.required')
        else if (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0) nextErrors[key] = t('company.unit.nonnegative')
      }
      setErrors(nextErrors)
      const first = fields.find((key) => nextErrors[key])
      if (nextErrors.period || first) {
        document.getElementById(nextErrors.period ? `${prefix}-period` : `${prefix}-${first}`)?.focus()
        return
      }
    }
    inFlight.current = true
    setPending(true)
    setApiError(null)
    try {
      if (deleting) await onDelete!(selectedSource!.id)
      else await onSave({ period: periodValue, type: typeValue, fot: Number(values.fot), marketing: Number(values.marketing), development: Number(values.development), gna: Number(values.gna) })
      onClose()
    } catch (error) {
      setApiError(t(deleting ? 'company.unit.deleteFailed' : 'company.unit.saveFailed', { message: normalizeApiError(error).message }))
    } finally { inFlight.current = false; setPending(false) }
  }

  return <>
    <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose() }}>
      <DialogContent closeLabel={t('common.cancel')}>
        <DialogHeader>
          <DialogTitle>{t(selectedSource ? 'company.pnl.editBudget' : 'company.budget.add')}</DialogTitle>
          <DialogDescription>{t(chooseIdentity ? 'company.budget.createDescription' : 'company.pnl.budgetDescription')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm font-medium">{t('company.unit.source', { type, period })}</p>
        <p className="text-xs text-muted-foreground">{t('company.metrics.monthlyHint')}</p>
        <form noValidate className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(false) }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor={`${prefix}-period`} className="block text-sm font-medium">{t('common.period')}</label>
              {chooseIdentity ? <MonthPicker id={`${prefix}-period`} value={periodValue.slice(0, 7)} disabled={pending} aria-label={t('common.period')}
                  onChange={(month) => setPeriodValue(month ? `${month}-01` : '')} />
              : <Input id={`${prefix}-period`} value={period} readOnly />}
              {errors.period && <p role="alert" className="text-sm text-destructive">{errors.period}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor={`${prefix}-type`} className="block text-sm font-medium">{t('common.type')}</label>
              {chooseIdentity ? <select id={`${prefix}-type`} disabled={pending} value={typeValue}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => setTypeValue(event.target.value as 'plan' | 'fact')}>
                <option value="plan">{t('common.plan')}</option><option value="fact">{t('common.fact')}</option>
              </select> : <Input id={`${prefix}-type`} value={type} readOnly />}
            </div>
          </div>
          {fields.map((key) => <div key={key} className="space-y-1">
            <label htmlFor={`${prefix}-${key}`} className="block text-sm font-medium">{t(`company.budget.${key}`)}</label>
            <Input id={`${prefix}-${key}`} type="number" inputMode="decimal" min={0} step="any" required disabled={pending}
              value={values[key]} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${prefix}-${key}-error` : undefined}
              onChange={(event) => { setValues((old) => ({ ...old, [key]: event.target.value })); setErrors((old) => ({ ...old, [key]: undefined })); setApiError(null) }} />
            {errors[key] && <p id={`${prefix}-${key}-error`} className="text-sm text-destructive">{errors[key]}</p>}
          </div>)}
          {!confirmDelete && apiError && <p role="alert" className="text-sm text-destructive">{apiError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={pending} onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={pending}>{t('common.save')}</Button>
          </DialogFooter>
        </form>
        {selectedSource && onDelete && <div className="border-t pt-4">
          <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={pending}
            onClick={() => { setApiError(null); setConfirmDelete(true) }}>{t('company.unit.deleteSource')}</Button>
        </div>}
      </DialogContent>
    </Dialog>
    <Dialog open={confirmDelete} onOpenChange={(open) => { if (!pending) { setConfirmDelete(open); setApiError(null) } }}>
      <DialogContent closeLabel={t('common.cancel')}>
        <DialogHeader>
          <DialogTitle>{t('company.budget.deleteTitle', { period, type })}</DialogTitle>
          <DialogDescription>{t('company.pnl.deleteBudgetDescription', { type })}</DialogDescription>
        </DialogHeader>
        {apiError && <p role="alert" className="text-sm text-destructive">{apiError}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={() => { setConfirmDelete(false); setApiError(null) }}>{t('common.cancel')}</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void submit(true)}>{t('common.delete')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
}
