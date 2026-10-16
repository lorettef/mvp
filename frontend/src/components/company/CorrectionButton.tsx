import { useRef, useState } from 'react'
import { PencilRuler } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { normalizeApiError } from '@/lib/apiError'
import { formatCorrectionValue } from '@/lib/correctionFormatting'
import type { ReviewCorrection, ReviewCorrectionCreate } from '@/types/api'

interface Props {
  label: string
  valueKey: string
  currentValue: string | number | null | undefined
  target: Omit<ReviewCorrectionCreate, 'corrected_value' | 'reason'>
  corrections: ReviewCorrection[]
  canCreate: boolean
  onCreate: (data: ReviewCorrectionCreate) => Promise<unknown>
  loading?: boolean
  error?: boolean
  onRetry?: () => void
}

export function CorrectionButton({ label, valueKey, currentValue, target, corrections, canCreate, onCreate, loading, error, onRetry }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const inFlight = useRef(false)
  const latestCurrent = [...corrections].reverse().find(item => !item.isStale)
  if ((!canCreate || currentValue == null) && corrections.length === 0) return null
  const formatted = (v: string | number | null | undefined) => formatCorrectionValue(v, valueKey, months => t('company.unit.monthsShort', { value: months }))
  const submit = async () => {
    if (!value.trim() || !Number.isFinite(Number(value)) || !reason.trim() || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setSubmitError(null)
    try {
      await onCreate({ ...target, corrected_value: value.trim(), reason: reason.trim() })
      setValue('')
      setReason('')
    } catch (cause) {
      setSubmitError(normalizeApiError(cause).message)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  return <span className="inline-flex min-w-0 flex-col items-end gap-0.5">
    {latestCurrent && <span className="max-w-48 text-right text-xs text-primary whitespace-normal break-words">
      {t('corrections.current')}: {formatted(latestCurrent.correctedValue)}
    </span>}
    {corrections.length > 0 && !latestCurrent && <span className="max-w-48 text-right text-xs text-muted-foreground whitespace-normal break-words">{t('corrections.stale')}</span>}
    <Button type="button" size="sm" variant="ghost" className="h-8 min-w-8 gap-1 px-2"
      aria-label={t(canCreate ? 'corrections.openTarget' : 'corrections.viewTarget', { label })} onClick={() => setOpen(true)}>
      <PencilRuler className="h-4 w-4" aria-hidden="true" />{corrections.length > 0 && <span>{corrections.length}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent closeLabel={t('corrections.close')} className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{t('corrections.targetTitle', { label })}</DialogTitle></DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t('corrections.loadError')}</p><Button type="button" variant="outline" onClick={onRetry}>{t('common.retry')}</Button></div>}
        {!loading && !error && (corrections.length === 0
          ? <p className="text-sm text-muted-foreground">{t('corrections.empty')}</p>
          : <ol className="max-h-64 space-y-3 overflow-y-auto">{corrections.map(item => <li key={item.id} className="rounded-md border p-3 text-sm break-words">
            <p className="font-medium">{item.authorName} · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString(i18n.language)}</time></p>
            <p>{t('corrections.original')}: {formatted(item.originalValue)}</p>
            <p>{t('corrections.corrected')}: {formatted(item.correctedValue)}</p>
            <p className="whitespace-pre-wrap break-words">{t('corrections.reason')}: {item.reason}</p>
            <p className={item.isStale ? 'text-muted-foreground' : 'text-primary'}>{item.isStale ? t('corrections.stale') : t('corrections.currentStatus')}</p>
          </li>)}</ol>)}
        {canCreate && currentValue != null && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit() }}>
          <p className="text-sm">{t('corrections.original')}: <strong>{formatted(currentValue)}</strong></p>
          <label className="block text-sm font-medium" htmlFor="correction-value">{t('corrections.corrected')}</label>
          <Input id="correction-value" inputMode="decimal" value={value} disabled={pending} onChange={event => setValue(event.target.value)} />
          <label className="block text-sm font-medium" htmlFor="correction-reason">{t('corrections.reason')}</label>
          <Textarea id="correction-reason" value={reason} maxLength={3000} disabled={pending} onChange={event => setReason(event.target.value)} />
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          <Button type="submit" disabled={!value.trim() || !Number.isFinite(Number(value)) || !reason.trim() || pending}>{t('corrections.add')}</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </span>
}
