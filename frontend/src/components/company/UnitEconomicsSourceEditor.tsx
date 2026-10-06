import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MetricUpsert, UnitEconomicsMetricSource } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { normalizeApiError } from '@/lib/apiError'
import { formatMonthLabel } from '@/lib/format'

interface Props {
  source: UnitEconomicsMetricSource
  metricLabel?: (key: string, fallback: string) => string
  onSave: (data: MetricUpsert) => Promise<unknown>
  onDelete: (id: string) => Promise<unknown>
  onClose: () => void
  isSaving?: boolean
  isDeleting?: boolean
}

export function UnitEconomicsSourceEditor({ source, metricLabel = (_, fallback) => fallback, onSave, onDelete, onClose, isSaving, isDeleting }: Props) {
  const { t, i18n } = useTranslation()
  const prefix = useId()
  const [values, setValues] = useState({
    new_units: String(source.newUnits),
    arpu: source.arpu == null ? '' : String(source.arpu),
    revenue: String(source.revenue),
    marketing_spend: String(source.marketingSpend),
    retention_rate: String(source.retentionRate * 100),
  })
  type Field = keyof typeof values
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({})
  const [apiError, setApiError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const busy = pending || isSaving || isDeleting
  const period = formatMonthLabel(source.period.slice(0, 7), i18n.language)
  const type = t(`common.${source.type}`)
  const fields: Array<{ key: Field; label: string; min: number; max?: number; step: string }> = [
    { key: 'new_units', label: metricLabel('new_units', t('company.unit.newUnits')), min: 0, step: '1' },
    { key: 'arpu', label: metricLabel('arpu', t('company.unit.arpu')), min: 0, step: 'any' },
    { key: 'revenue', label: metricLabel('revenue', t('company.unit.revenue')), min: 0, step: 'any' },
    { key: 'marketing_spend', label: metricLabel('marketing_spend', t('company.unit.marketing')), min: 0, step: 'any' },
    { key: 'retention_rate', label: `${metricLabel('retention_rate', t('company.unit.retentionInput'))}${metricLabel('retention_rate', '') ? ' (%)' : ''}`, min: 0, max: 100, step: 'any' },
  ]

  const save = async () => {
    if (inFlight.current || busy) return
    const nextErrors: Partial<Record<Field, string>> = {}
    for (const { key } of fields) {
      const raw = values[key].trim()
      const value = Number(raw)
      if (!raw) nextErrors[key] = t('company.unit.required')
      else if (key === 'new_units' && (!Number.isSafeInteger(value) || value < 0)) nextErrors[key] = t('company.unit.integer')
      else if (key === 'arpu' && (!Number.isFinite(value) || value <= 0)) nextErrors[key] = t('company.unit.positive')
      else if (key === 'retention_rate' && (!Number.isFinite(value) || value < 0 || value > 100)) nextErrors[key] = t('company.unit.retentionRange')
      else if (!Number.isFinite(value) || value < 0) nextErrors[key] = t('company.unit.nonnegative')
    }
    setErrors(nextErrors)
    const first = fields.find(({ key }) => nextErrors[key])
    if (first) {
      document.getElementById(`${prefix}-${first.key}`)?.focus()
      return
    }
    inFlight.current = true
    setPending(true)
    setApiError(null)
    try {
      await onSave({
        period: source.period,
        type: source.type,
        new_units: Number(values.new_units),
        arpu: Number(values.arpu),
        revenue: Number(values.revenue),
        marketing_spend: Number(values.marketing_spend),
        retention_rate: Number(values.retention_rate) / 100,
        ...(source.comment != null ? { comment: source.comment } : {}),
      })
      onClose()
    } catch (error) {
      setApiError(t('company.unit.saveFailed', { message: normalizeApiError(error).message }))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  const remove = async () => {
    if (inFlight.current || busy) return
    inFlight.current = true
    setPending(true)
    setApiError(null)
    try {
      await onDelete(source.id)
      onClose()
    } catch (error) {
      setApiError(t('company.unit.deleteFailed', { message: normalizeApiError(error).message }))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
        <DialogContent closeLabel={t('common.cancel')}>
          <DialogHeader>
            <DialogTitle>{t('company.unit.editSource')}</DialogTitle>
            <DialogDescription>{t('company.unit.sourceDescription')}</DialogDescription>
          </DialogHeader>
          <p className="text-sm font-medium">{t('company.unit.source', { type, period })}</p>
          <p className="text-xs text-muted-foreground">{t('company.metrics.monthlyHint')}</p>
          <form noValidate className="space-y-4" onSubmit={(event) => { event.preventDefault(); void save() }}>
            {fields.map(({ key, label, min, max, step }) => (
              <div key={key} className="space-y-1">
                <label htmlFor={`${prefix}-${key}`} className="text-sm font-medium">{label}</label>
                <Input id={`${prefix}-${key}`} type="number" inputMode={key === 'new_units' ? 'numeric' : 'decimal'} min={min} max={max} step={step}
                  required disabled={Boolean(busy)} value={values[key]} aria-invalid={Boolean(errors[key])}
                  aria-describedby={errors[key] ? `${prefix}-${key}-error` : undefined}
                  onChange={(event) => {
                    setValues((previous) => ({ ...previous, [key]: event.target.value }))
                    setErrors((previous) => ({ ...previous, [key]: undefined }))
                    setApiError(null)
                  }} />
                {errors[key] && <p id={`${prefix}-${key}-error`} className="text-sm text-destructive">{errors[key]}</p>}
              </div>
            ))}
            {!confirmDelete && apiError && <p role="alert" className="text-sm text-destructive">{apiError}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={onClose}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={Boolean(busy)}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
          <div className="border-t pt-4">
            <Button type="button" variant="outline" className="text-destructive hover:text-destructive" disabled={Boolean(busy)}
              onClick={() => { setApiError(null); setConfirmDelete(true) }}>{t('company.unit.deleteSource')}</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmDelete} onOpenChange={(open) => { if (!busy) { setConfirmDelete(open); setApiError(null) } }}>
        <DialogContent closeLabel={t('common.cancel')}>
          <DialogHeader>
            <DialogTitle>{t('company.unit.deleteTitle', { period })}</DialogTitle>
            <DialogDescription>{t('company.unit.deleteDescription', { type })}</DialogDescription>
          </DialogHeader>
          {apiError && <p role="alert" className="text-sm text-destructive">{apiError}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => { setConfirmDelete(false); setApiError(null) }}>{t('common.cancel')}</Button>
            <Button type="button" variant="destructive" disabled={Boolean(busy)} onClick={() => void remove()}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
