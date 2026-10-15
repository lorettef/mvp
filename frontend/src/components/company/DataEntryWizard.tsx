import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Plus, Trash2 } from 'lucide-react'
import { companiesApi } from '@/api/companies'
import type { BudgetUpsert, CohortUpsert, MetricBulkUpsert } from '@/types/api'
import { normalizeApiError } from '@/lib/apiError'
import { SKIP_GLOBAL_ERROR } from '@/lib/toastError'
import { invalidateFinancialSources } from '@/lib/financialSourceQueries'
import { budgetInputFields, type MetricInputField } from '@/lib/financialSourceForm'
import {
  budgetEntryErrors, budgetEntryPayload, cohortEntryErrors, cohortEntryPayload, currentEntryMonth,
  duplicateEntryIds, emptyBudgetEntry, emptyMetricEntry, metricEntryErrors, metricEntryPayload, nextEntryMonth,
  type BudgetEntryRow, type CohortEntry, type EntryErrors, type EntryIdentity, type MetricEntryRow,
} from '@/lib/dataEntryForm'
import { cn } from '@/lib/utils'
import { formatMonthLabel } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MonthPicker } from '@/components/ui/month-picker'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { BudgetAmountFields } from './BudgetAmountFields'

interface Props {
  industry?: string | null
  companyId: string
  tenantKey: string
  metricLabel?: (key: string, fallback: string) => string
  onClose: () => void
}

function IdentityFields({ prefix, value, errors, disabled, onChange, onBlur }: {
  prefix: string; value: EntryIdentity; errors: EntryErrors; disabled: boolean
  onChange: (field: 'period' | 'type', value: string) => void
  onBlur: (field: string) => void
}) {
  const { t } = useTranslation()
  return <div className="grid min-w-0 grid-cols-2 gap-3">
    <div className="min-w-0 space-y-1">
      <label htmlFor={`${prefix}-period`} className="block text-sm font-medium">{t('common.period')}</label>
      <MonthPicker id={`${prefix}-period`} aria-label={t('common.period')} value={value.period} disabled={disabled}
        aria-invalid={Boolean(errors.period)} aria-describedby={errors.period ? `${prefix}-period-error` : undefined}
        onChange={(month) => { onChange('period', month); onBlur('period') }} />
      {errors.period && <p id={`${prefix}-period-error`} className="text-sm text-destructive">{errors.period}</p>}
    </div>
    <div className="min-w-0 space-y-1">
      <label htmlFor={`${prefix}-type`} className="block text-sm font-medium">{t('common.type')}</label>
      <select id={`${prefix}-type`} value={value.type} disabled={disabled} required
        aria-invalid={Boolean(errors.type)} aria-describedby={errors.type ? `${prefix}-type-error` : undefined}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onChange={(event) => onChange('type', event.target.value)} onBlur={() => onBlur('type')}>
        <option value="">{t('company.wizard.chooseType')}</option>
        <option value="plan">{t('common.plan')}</option><option value="fact">{t('common.fact')}</option>
      </select>
      {errors.type && <p id={`${prefix}-type-error`} className="text-sm text-destructive">{errors.type}</p>}
    </div>
  </div>
}

function NumberField({ id, label, value, error, disabled, onChange, onBlur, onBadInput, integer, max, min = 0, required }: {
  id: string; label: string; value: string; error?: string; disabled: boolean; integer?: boolean; max?: number; min?: number; required?: boolean
  onChange: (value: string) => void; onBlur: () => void; onBadInput?: (bad: boolean) => void
}) {
  return <div className="min-w-0 space-y-1">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <Input id={id} type="number" inputMode={integer ? 'numeric' : 'decimal'} min={min} max={max} step={integer ? '1' : 'any'} required={required}
      disabled={disabled} value={value} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onInput={(event) => onBadInput?.(event.currentTarget.validity.badInput)}
      onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
    {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
  </div>
}

/** A local session with real, non-atomic progress. API writes and cache invalidation are scoped to its origin. */
export function DataEntryWizard({ industry, companyId, tenantKey, metricLabel = (_, fallback) => fallback, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const client = useQueryClient()
  const prefix = useId()
  const origin = useRef({ companyId, tenantKey }).current
  const currentScope = useRef({ companyId, tenantKey })
  currentScope.current = { companyId, tenantKey }
  const sameScope = origin.companyId === companyId && origin.tenantKey === tenantKey
  const mounted = useRef(true)
  const active = () => mounted.current && currentScope.current.companyId === origin.companyId && currentScope.current.tenantKey === origin.tenantKey
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => { if (!sameScope) onClose() }, [sameScope, onClose])

  const [step, setStep] = useState(0)
  const [metricRows, setMetricRows] = useState<MetricEntryRow[]>(() => [emptyMetricEntry(1, currentEntryMonth(), 'fact')])
  const [cohort, setCohort] = useState<CohortEntry>(() => ({ period:currentEntryMonth(),type:'fact',size:'',marketing:'',retention:Array<string>(12).fill('') }))
  const [budgetRows, setBudgetRows] = useState<BudgetEntryRow[]>(() => [emptyBudgetEntry(2, currentEntryMonth(), 'fact')])
  const nextId = useRef(3)
  const [metricSaved, setMetricSaved] = useState(false)
  const [cohortSaved, setCohortSaved] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const [dirty, setDirty] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [touched, setTouched] = useState<Set<string>>(() => new Set())
  const [attempted, setAttempted] = useState(false)
  // Number inputs expose incomplete numeric drafts (e.g. "e") as value="".
  // Optional Cohort fields must distinguish them from genuinely missing values.
  const [budgetBadInputs, setBudgetBadInputs] = useState<Set<string>>(new Set())
  const [cohortBadInputs, setCohortBadInputs] = useState<Set<string>>(() => new Set())
  const [apiError, setApiError] = useState<{ message: string; rowId?: number }>()
  const stepTitle = useRef<HTMLHeadingElement>(null)
  useLayoutEffect(() => { stepTitle.current?.focus() }, [step])

  const invalidate = () => invalidateFinancialSources(client, origin.tenantKey, origin.companyId)
  const metricSave = useMutation({ mutationFn:(data: MetricBulkUpsert) => companiesApi.upsertMetricBulk(origin.companyId, data), onSuccess:invalidate, meta:SKIP_GLOBAL_ERROR })
  const cohortSave = useMutation({ mutationFn:(data: CohortUpsert) => companiesApi.upsertCohort(origin.companyId, data), onSuccess:invalidate, meta:SKIP_GLOBAL_ERROR })
  const budgetSave = useMutation({ mutationFn:(data: BudgetUpsert) => companiesApi.upsertBudget(origin.companyId, data), onSuccess:invalidate, meta:SKIP_GLOBAL_ERROR })

  const metricDuplicates = duplicateEntryIds(metricRows)
  const budgetDuplicates = duplicateEntryIds(budgetRows)
  const valid = step === 0 ? metricRows.every((row) => !Object.keys(metricEntryErrors(row)).length) && !metricDuplicates.size
    : step === 1 ? !Object.keys(cohortEntryErrors(cohort)).length && !cohortBadInputs.size
      : budgetBadInputs.size === 0 && budgetRows.every((row) => !Object.keys(budgetEntryErrors(row)).length) && !budgetDuplicates.size
  const savedBudgets = budgetRows.filter((row) => row.saved).length
  const persisted = metricSaved || cohortSaved || savedBudgets > 0
  const completed = [metricSaved, cohortSaved, savedBudgets === budgetRows.length]
  const steps = ['metric', 'cohort', 'budget'] as const
  const touch = (row: string | number, field: string) => setTouched((old) => new Set([...old, `${row}:${field}`]))
  const shownErrors = (row: string | number, errors: EntryErrors): EntryErrors => Object.fromEntries(Object.entries(errors)
    .filter(([field]) => attempted || touched.has(`${row}:${field}`)).map(([field, key]) => [field, t(key!)]))
  const changed = () => { setDirty(true); setApiError(undefined) }
  const requestClose = () => {
    if (inFlight.current) return
    if (step === 3 || (!dirty && !persisted)) onClose()
    else setConfirmClose(true)
  }
  const advance = (next: number) => { setAttempted(false); setApiError(undefined); setCohortBadInputs(new Set()); setStep(next) }
  const cohortBadInput = (field: string, bad: boolean) => {
    if (bad) changed()
    setCohortBadInputs((old) => { const next = new Set(old); if (bad) next.add(field); else next.delete(field); return next })
  }

  const submit = async () => {
    if (inFlight.current || !active()) return
    setAttempted(true)
    if (!valid) return
    if (step === 0 && metricSaved) { advance(1); return }
    if (step === 1 && cohortSaved) { advance(2); return }
    inFlight.current = true
    setPending(true)
    setApiError(undefined)
    let savingRow: BudgetEntryRow | undefined
    try {
      if (step === 0) {
        // Preserve the canonical bulk call and chronological Fact sequence;
        // active_units and other financial derivations remain on the backend.
        const items = metricRows.map(metricEntryPayload).sort((a, b) => a.period.localeCompare(b.period))
        await metricSave.mutateAsync({ items })
        if (!active()) return
        setMetricSaved(true)
        setCohort((old) => ({ ...old,period:items[0].period.slice(0, 7),type:items[0].type }))
        setBudgetRows([emptyBudgetEntry(2, items[0].period.slice(0, 7), items[0].type)])
        advance(1)
      } else if (step === 1) {
        await cohortSave.mutateAsync(cohortEntryPayload(cohort))
        if (!active()) return
        setCohortSaved(true)
        advance(2)
      } else {
        for (const row of [...budgetRows].sort((a, b) => a.period.localeCompare(b.period))) {
          if (!active()) return // A company/tenant switch stops remaining requests.
          if (row.saved) continue
          savingRow = row
          await budgetSave.mutateAsync(budgetEntryPayload(row))
          if (!active()) return
          setBudgetRows((old) => old.map((item) => item.id === row.id ? { ...item,saved:true } : item))
        }
        advance(3)
      }
    } catch (error) {
      if (active()) setApiError({
        message:savingRow ? t('company.wizard.rowSaveFailed', {
          period:formatMonthLabel(savingRow.period, i18n.language),type:t(`common.${savingRow.type}`),message:normalizeApiError(error).message,
        }) : t('company.unit.saveFailed', { message:normalizeApiError(error).message }),
        rowId:savingRow?.id,
      })
    } finally {
      inFlight.current = false
      if (active()) setPending(false)
    }
  }

  const metricFields: Array<{ field: MetricInputField; label: string }> = [
    { field:'new_units',label:metricLabel('new_units', t('company.unit.newUnits')) },
    { field:'arpu',label:metricLabel('arpu', t('company.unit.arpu')) },
    { field:'revenue',label:metricLabel('revenue', t('company.unit.revenue')) },
    { field:'marketing_spend',label:metricLabel('marketing_spend', t('company.unit.marketing')) },
    { field:'retention_rate',label:`${metricLabel('retention_rate', t('company.wizard.retention'))} (%)` },
  ]
  const savedSummary = [metricSaved ? t('company.wizard.savedMetric', { count:metricRows.length }) : '', cohortSaved ? t('company.wizard.savedCohort') : '',
    savedBudgets ? t('company.wizard.savedBudget', { count:savedBudgets }) : ''].filter(Boolean).join('; ')
  if (!sameScope) return null

  return <>
    <Dialog open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogContent closeLabel={t('common.cancel')}
        className="flex h-[min(48rem,calc(100dvh-2rem))] min-w-0 max-w-4xl flex-col gap-3 overflow-hidden p-0"
        onOpenAutoFocus={(event) => { event.preventDefault(); stepTitle.current?.focus() }}
        onEscapeKeyDown={(event) => {
          // A nested calendar owns its Escape; it must not dismiss this session.
          if (inFlight.current || event.target instanceof Element && event.target.closest('[data-month-picker-popover]')) event.preventDefault()
        }}>
        <DialogHeader className="shrink-0 border-b px-4 pb-3 pt-4 pr-12 text-left">
          <DialogTitle>{t('company.wizard.start')}</DialogTitle>
          <DialogDescription>{t('company.wizard.description')}</DialogDescription>
        </DialogHeader>
        <ol aria-label={t('company.wizard.steps')} className="grid shrink-0 grid-cols-3 gap-2 px-4">
          {steps.map((name, index) => <li key={name} aria-current={step === index ? 'step' : undefined}
            className={cn('flex min-w-0 items-center gap-2 rounded-md border p-2 text-xs sm:text-sm', step === index && 'border-primary bg-primary/10', completed[index] && 'text-success')}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden="true">{completed[index] ? <Check className="h-4 w-4" /> : index + 1}</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{t(`company.wizard.${name}`)}<span className="sr-only"> — {t(completed[index] ? 'company.wizard.saved' : step === index ? 'company.wizard.current' : 'company.wizard.future')}</span></span>
          </li>)}
        </ol>
        {step === 3 ? <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 overflow-y-auto p-4 text-center">
          <h3 ref={stepTitle} tabIndex={-1} className="text-xl font-semibold" role="status">{t('company.wizard.success')}</h3>
          <p className="text-sm text-muted-foreground">{t('company.wizard.successDescription')}</p>
          <Button type="button" onClick={onClose}>{t('company.wizard.done')}</Button>
        </div> : <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4" aria-busy={pending}>
            <h3 ref={stepTitle} tabIndex={-1} className="font-semibold">{t(`company.wizard.${steps[step]}`)}</h3>
            {(step === 0 && metricSaved || step === 1 && cohortSaved) && <p role="status" className="text-sm text-muted-foreground">{t('company.wizard.savedReadOnly')}</p>}
            {step === 0 && <>
              {metricRows.map((row, index) => {
                const id = `${prefix}-metric-${row.id}`
                const errors = shownErrors(row.id, metricEntryErrors(row))
                const update = (field: 'period' | 'type' | 'comment' | MetricInputField, value: string) => {
                  changed(); touch(row.id, field)
                  setMetricRows((old) => old.map((item) => item.id !== row.id ? item : field === 'period' || field === 'type' || field === 'comment'
                    ? { ...item,[field]:value } as MetricEntryRow : { ...item,values:{ ...item.values,[field]:value } }))
                }
                return <fieldset key={row.id} disabled={pending || metricSaved} className="min-w-0 space-y-3 rounded-md border p-3">
                  <legend className="px-1 font-medium">{t('company.wizard.monthRow', { step:t('company.wizard.metric'),number:index + 1 })}</legend>
                  {index > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => { changed(); setMetricRows((old) => old.filter((item) => item.id !== row.id)) }}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />{t('company.wizard.removeMonth')}
                  </Button>}
                  <IdentityFields prefix={id} value={row} errors={errors} disabled={pending || metricSaved} onChange={update} onBlur={(field) => touch(row.id, field)} />
                  {metricDuplicates.has(row.id) && <p role="alert" className="text-sm text-destructive">{t('company.wizard.duplicate')}</p>}
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {metricFields.map(({ field,label }) => <NumberField key={field} id={`${id}-${field}`} label={label} value={row.values[field]}
                      disabled={pending || metricSaved} required integer={field === 'new_units'} min={0} max={field === 'retention_rate' ? 100 : undefined}
                      error={errors[field]} onChange={(value) => update(field, value)} onBlur={() => touch(row.id, field)} />)}
                    <div className="min-w-0 space-y-1">
                      <label htmlFor={`${id}-comment`} className="block text-sm font-medium">{t('company.pnl.comment')}</label>
                      <Input id={`${id}-comment`} value={row.comment} onChange={(event) => update('comment', event.target.value)} />
                    </div>
                  </div>
                </fieldset>
              })}
              {!metricSaved && <Button type="button" variant="outline" disabled={pending || !nextEntryMonth(metricRows[metricRows.length - 1].period)}
                onClick={() => { changed(); setMetricRows((old) => [...old,emptyMetricEntry(nextId.current++, nextEntryMonth(old[old.length - 1].period))]) }}>
                <Plus className="h-4 w-4" aria-hidden="true" />{t('company.wizard.addMonth')}
              </Button>}
            </>}
            {step === 1 && (() => {
              const id = `${prefix}-cohort`
              const errors = shownErrors('cohort', cohortEntryErrors(cohort))
              for (const field of cohortBadInputs) errors[field] = t('company.unit.nonnegative')
              const update = (field: 'period' | 'type' | 'size' | 'marketing', value: string) => { changed(); touch('cohort', field); setCohort((old) => ({ ...old,[field]:value } as CohortEntry)) }
              return <fieldset disabled={pending || cohortSaved} className="min-w-0 space-y-4 rounded-md border p-3">
                <legend className="px-1 font-medium">{t('company.wizard.cohort')}</legend>
                <IdentityFields prefix={id} value={cohort} errors={errors} disabled={pending || cohortSaved} onChange={update} onBlur={(field) => touch('cohort', field)} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <NumberField id={`${id}-size`} label={t('company.cohorts.size')} value={cohort.size} error={errors.size} integer min={1} required disabled={pending || cohortSaved}
                    onChange={(value) => update('size', value)} onBlur={() => touch('cohort', 'size')} />
                  <NumberField id={`${id}-marketing`} label={t('common.marketingRub')} value={cohort.marketing} error={errors.marketing} disabled={pending || cohortSaved}
                    onBadInput={(bad) => cohortBadInput('marketing', bad)}
                    onChange={(value) => update('marketing', value)} onBlur={() => touch('cohort', 'marketing')} />
                </div>
                <p className="text-xs text-muted-foreground">{t('company.wizard.cohortHint')}</p>
                <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
                  {cohort.retention.map((value, index) => <NumberField key={index} id={`${id}-m${index + 1}`} label={`M${index + 1} (%)`} value={value}
                    error={errors[`retention-${index + 1}`]} disabled={pending || cohortSaved} max={100}
                    onBadInput={(bad) => cohortBadInput(`retention-${index + 1}`, bad)}
                    onChange={(raw) => { changed(); touch('cohort', `retention-${index + 1}`); setCohort((old) => ({ ...old,retention:old.retention.map((item, i) => i === index ? raw : item) })) }}
                    onBlur={() => touch('cohort', `retention-${index + 1}`)} />)}
                </div>
              </fieldset>
            })()}
            {step === 2 && <>
              {savedBudgets > 0 && savedBudgets < budgetRows.length && <p role="status" className="text-sm text-muted-foreground">{t('company.wizard.partialBudget', { saved:savedBudgets,total:budgetRows.length })}</p>}
              {budgetRows.map((row, index) => {
                const id = `${prefix}-budget-${row.id}`
                const errors = shownErrors(row.id, budgetEntryErrors(row))
                return <fieldset key={row.id} disabled={pending || row.saved} className="min-w-0 space-y-3 rounded-md border p-3">
                  <legend className="px-1 font-medium">{t('company.wizard.monthRow', { step:t('company.wizard.budget'),number:index + 1 })}</legend>
                  {row.saved && <p role="status" className="text-sm text-success">{t('company.wizard.savedReadOnly')}</p>}
                  {index > 0 && !row.saved && <Button type="button" variant="ghost" size="sm" onClick={() => { changed(); setBudgetRows((old) => old.filter((item) => item.id !== row.id)); setBudgetBadInputs(old => new Set([...old].filter(key => !key.startsWith(`${row.id}:`)))) }}>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />{t('company.wizard.removeMonth')}
                  </Button>}
                  <IdentityFields prefix={id} value={row} errors={errors} disabled={pending || row.saved}
                    onChange={(field, value) => { changed(); touch(row.id, field); setBudgetRows((old) => old.map((item) => item.id === row.id ? { ...item,[field]:value } as BudgetEntryRow : item)) }} onBlur={(field) => touch(row.id, field)} />
                  {budgetDuplicates.has(row.id) && <p role="alert" className="text-sm text-destructive">{t('company.wizard.duplicate')}</p>}
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                    <BudgetAmountFields industry={industry} prefix={id}
                      onBadInput={(field, bad) => setBudgetBadInputs(old => { const next = new Set(old); const key = `${row.id}:${field}`; if (bad) next.add(key); else next.delete(key); return next })} values={row.values} errors={Object.fromEntries(budgetInputFields.map((field) => [field,errors[field]]))} disabled={pending || row.saved}
                      onBlur={(field) => touch(row.id, field)} onChange={(field, value) => { changed(); touch(row.id, field); setBudgetRows((old) => old.map((item) => item.id === row.id ? { ...item,values:{ ...item.values,[field]:value } } : item)) }} />
                  </div>
                  {apiError?.rowId === row.id && <p role="alert" className="text-sm text-destructive">{apiError.message}</p>}
                </fieldset>
              })}
              <Button type="button" variant="outline" disabled={pending || !nextEntryMonth(budgetRows[budgetRows.length - 1].period)}
                onClick={() => { changed(); setBudgetRows((old) => [...old,emptyBudgetEntry(nextId.current++, nextEntryMonth(old[old.length - 1].period))]) }}>
                <Plus className="h-4 w-4" aria-hidden="true" />{t('company.wizard.addMonth')}
              </Button>
            </>}
            {apiError && apiError.rowId == null && <p role="alert" className="text-sm text-destructive">{apiError.message}</p>}
          </div>
          <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t bg-elevated p-3">
            {pending && <span role="status" className="w-full text-sm text-muted-foreground">{t('common.saving')}</span>}
            <Button type="button" variant="outline" disabled={pending} onClick={requestClose}>{t('common.cancel')}</Button>
            {step > 0 && <Button type="button" variant="outline" disabled={pending} onClick={() => advance(step - 1)}>{t('company.wizard.back')}</Button>}
            <Button type="submit" disabled={!valid || pending}>{t(step === 2 ? 'company.wizard.finish' : 'company.wizard.next')}</Button>
          </footer>
        </form>}
      </DialogContent>
    </Dialog>
    <ConfirmDialog open={confirmClose} onOpenChange={setConfirmClose} title={t(persisted ? 'company.wizard.partialClose' : 'company.wizard.dirtyClose')}
      description={t(persisted ? 'company.wizard.partialCloseDescription' : 'company.wizard.dirtyCloseDescription', { steps:savedSummary })}
      confirmLabel={t('company.wizard.close')} cancelLabel={t('company.wizard.continueEntry')} onConfirm={onClose} />
  </>
}
