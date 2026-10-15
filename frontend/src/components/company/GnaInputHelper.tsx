import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gnaSuggestionKeys } from '@/lib/gnaSuggestions'
import { numericInputError } from '@/lib/financialSourceForm'
import { fmtRub } from '@/lib/format'

/** Local calculator only. Applying changes the form's aggregate, never sends a request. */
export function GnaInputHelper({ industry, disabled, onApply }: {
  industry?: string | null; disabled?: boolean; onApply: (total: number) => void
}) {
  const { t } = useTranslation()
  const prefix = useId()
  const [open, setOpen] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [custom, setCustom] = useState<Array<{ id: number; name: string; amount: string }>>([])
  const [badAmounts, setBadAmounts] = useState<Set<string>>(new Set())
  const markBad = (key: string, bad: boolean) => setBadAmounts(old => { const next = new Set(old); if (bad) next.add(key); else next.delete(key); return next })
  const nextId = useRef(0)
  const suggestions = gnaSuggestionKeys(industry)
  const entered = suggestions.map(key => amounts[key] ?? '').filter(value => value.trim() !== '')
  const valid = badAmounts.size === 0 && entered.every(value => !numericInputError(value))
    && custom.every(row => row.name.trim() && !numericInputError(row.amount))
  const total = valid ? [...entered, ...custom.map(row => row.amount)].reduce((sum, raw) => sum + Number(raw), 0) : null
  const ready = valid && entered.length + custom.length > 0 && total !== null && Number.isFinite(total)
  const close = () => { setOpen(false); setAmounts({}); setCustom([]); setBadAmounts(new Set()) }
  if (!open) return <Button type="button" variant="outline" size="sm" className="max-w-full whitespace-normal" disabled={disabled} onClick={() => setOpen(true)}>{t('company.gnaHelper.open')}</Button>
  return <fieldset className="min-w-0 rounded-md border p-3 space-y-3" disabled={disabled}>
    <legend className="px-1 text-sm font-medium">{t('company.gnaHelper.title')}</legend>
    <p className="text-xs text-muted-foreground">{t('company.gnaHelper.notice')}</p>
    <p className="text-xs text-muted-foreground">{t('company.gnaHelper.optional')}</p>
    {suggestions.map(key => {
      const value = amounts[key] ?? ''
      const error = value.trim() !== '' && Boolean(numericInputError(value))
      return <div key={key} className="min-w-0 space-y-1">
        <label htmlFor={`${prefix}-${key}`} className="block text-sm">{t(`company.gnaHelper.categories.${key}`)}</label>
        <Input id={`${prefix}-${key}`} type="number" inputMode="decimal" min={0} step="any" value={value} aria-invalid={error || badAmounts.has(key)}
          onInput={event => markBad(key, event.currentTarget.validity.badInput)} onChange={event => setAmounts(old => ({ ...old, [key]: event.target.value }))} />
      </div>
    })}
    {custom.map((row, index) => <div key={row.id} className="min-w-0 space-y-2 rounded-md border p-2">
      <label htmlFor={`${prefix}-name-${row.id}`} className="block text-sm">{t('company.gnaHelper.customName', { number: index + 1 })}</label>
      <Input id={`${prefix}-name-${row.id}`} required value={row.name} aria-invalid={!row.name.trim()}
        onChange={event => setCustom(old => old.map(item => item.id === row.id ? { ...item, name: event.target.value } : item))} />
      <label htmlFor={`${prefix}-amount-${row.id}`} className="block text-sm">{t('company.gnaHelper.customAmount', { number: index + 1 })}</label>
      <Input id={`${prefix}-amount-${row.id}`} required type="number" inputMode="decimal" min={0} step="any" value={row.amount} aria-invalid={Boolean(numericInputError(row.amount)) || badAmounts.has(String(row.id))}
        onInput={event => markBad(String(row.id), event.currentTarget.validity.badInput)} onChange={event => setCustom(old => old.map(item => item.id === row.id ? { ...item, amount: event.target.value } : item))} />
      <Button type="button" variant="ghost" size="sm" aria-label={t('company.gnaHelper.remove', { number: index + 1 })} onClick={() => { markBad(String(row.id), false); setCustom(old => old.filter(item => item.id !== row.id)) }}><X className="h-4 w-4" aria-hidden="true" />{t('common.delete')}</Button>
    </div>)}
    <Button type="button" variant="outline" size="sm" className="max-w-full whitespace-normal" onClick={() => setCustom(old => [...old, { id: nextId.current++, name: '', amount: '' }])}><Plus className="h-4 w-4" aria-hidden="true" />{t('company.gnaHelper.add')}</Button>
    <p className="text-sm font-medium" role="status">{t('company.gnaHelper.total')}: {ready ? fmtRub(total) : '—'}</p>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={!ready || disabled} onClick={() => { if (ready) { onApply(total!); close() } }}>{t('company.gnaHelper.apply')}</Button>
      <Button type="button" variant="outline" size="sm" onClick={close}>{t('common.cancel')}</Button>
    </div>
  </fieldset>
}
