import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { normalizeApiError } from '@/lib/apiError'

interface Props {
  value: string
  children: ReactNode
  label: string
  onSave: (draft: string) => Promise<unknown>
  validate: (draft: string) => string | undefined
  isUnchanged?: (draft: string) => boolean
  busy?: boolean
  step?: string
  max?: number
}

/** Local draft/interaction only. The caller saves a source and supplies server display values. */
export function InlineSourceCell({ value, children, label, onSave, validate, isUnchanged, busy = false, step = 'any', max }: Props) {
  const { t } = useTranslation()
  const id = useId()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const active = useRef(false)
  const inFlight = useRef(false)
  const suppressBlur = useRef(false)
  const wasEditing = useRef(false)

  useLayoutEffect(() => {
    if (editing && !pending) {
      input.current?.focus()
      if (!wasEditing.current) input.current?.select()
    } else if (!editing && wasEditing.current) button.current?.focus()
    wasEditing.current = editing
  }, [editing, pending, error])

  const begin = () => {
    if (busy || inFlight.current) return
    active.current = true
    suppressBlur.current = false
    setDraft(value)
    setError(undefined)
    setEditing(true)
  }
  const finish = () => {
    active.current = false // Unmount/focus-related blur cannot commit again.
    setEditing(false)
    setError(undefined)
  }
  const commit = async (reason: 'enter' | 'blur') => {
    if (!active.current || inFlight.current || busy || (reason === 'blur' && suppressBlur.current)) return
    suppressBlur.current = true // Errors require a change or an explicit Enter retry.
    const message = validate(draft)
    if (message) { setError(message); input.current?.focus(); return }
    if (isUnchanged ? isUnchanged(draft) : draft === value) { finish(); return }
    inFlight.current = true // Synchronous guard: Enter and its blur share one request.
    setPending(true)
    setError(undefined)
    try {
      await onSave(draft)
      finish() // Display children from the caller's server state, never the draft.
    } catch (failure) {
      setError(t('company.unit.saveFailed', { message: normalizeApiError(failure).message }))
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }

  return <div className="inline-block min-w-0 max-w-full align-middle" aria-busy={pending || busy}>
    {editing ? <>
      <Input ref={input} type="number" inputMode={step === '1' ? 'numeric' : 'decimal'} min={0} max={max} step={step}
        className="h-8 w-28 max-w-full text-right tabular-nums" aria-label={label} aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : `${id}-hint`} readOnly={pending || busy} value={draft}
        onChange={(event) => { setDraft(event.target.value); setError(undefined); suppressBlur.current = false }}
        onBlur={() => { void commit('blur') }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') { event.preventDefault(); void commit('enter') }
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!inFlight.current) finish() }
        }} />
      <span id={`${id}-hint`} className="sr-only">{t('company.inline.hint')}</span>
      {pending && <span role="status" className="block text-xs text-muted-foreground">{t('common.saving')}</span>}
      {error && <p id={`${id}-error`} role="alert" className="max-w-48 whitespace-normal text-xs text-destructive [overflow-wrap:anywhere]">{error}</p>}
    </> : <button ref={button} type="button" aria-label={label} disabled={busy}
      className="max-w-full cursor-text rounded px-1 py-0.5 text-inherit hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait"
      onDoubleClick={begin} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); begin() } }}>
      {children}
    </button>}
  </div>
}
