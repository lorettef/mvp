import { useRef, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { ReviewComment, ReviewCommentCreate } from '@/types/api'
import { normalizeApiError } from '@/lib/apiError'

interface Props {
  label: string
  comments: ReviewComment[]
  canCreate: boolean
  onCreate: (data: ReviewCommentCreate) => Promise<unknown>
  target: Omit<ReviewCommentCreate, 'text'>
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  alwaysVisible?: boolean
}

export function CommentButton({ label, comments, canCreate, onCreate, target, loading, error, onRetry, alwaysVisible }: Props) {
  const { t, i18n } = useTranslation()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const inFlight = useRef(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  if (!alwaysVisible && !canCreate && comments.length === 0) return null
  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed || inFlight.current || trimmed.length > 3000) return
    inFlight.current = true
    setPending(true)
    setSubmitError(null)
    try {
      await onCreate({ ...target, text: trimmed })
      setText('')
    } catch (cause) {
      setSubmitError(normalizeApiError(cause).message)
    } finally {
      inFlight.current = false
      setPending(false)
    }
  }
  return <>
    <Button type="button" size="sm" variant="ghost" className="h-8 min-w-8 gap-1 px-2" aria-label={t('comments.openTarget', { label, count: comments.length })} onClick={() => setOpen(true)}>
      <MessageSquare className="h-4 w-4" aria-hidden="true" />{comments.length > 0 && <span>{comments.length}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent closeLabel={t('comments.close')}>
        <DialogHeader><DialogTitle>{t('comments.targetTitle', { label })}</DialogTitle></DialogHeader>
        {loading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
        {error && <div role="alert" className="space-y-2 text-sm text-destructive"><p>{t('comments.loadError')}</p><Button type="button" variant="outline" onClick={onRetry}>{t('common.retry')}</Button></div>}
        {!loading && !error && (comments.length === 0
          ? <p className="text-sm text-muted-foreground">{t('comments.empty')}</p>
          : <ol className="max-h-64 space-y-3 overflow-y-auto">{comments.map(comment => <li key={comment.id} className="rounded-md border p-3 text-sm">
            <p className="font-medium">{comment.authorName} · <time dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleString(i18n.language)}</time></p>
            <p className="whitespace-pre-wrap break-words">{comment.text}</p>
          </li>)}</ol>)}
        {canCreate && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void submit() }}>
          <label className="block text-sm font-medium" htmlFor="fund-review-comment">{t('comments.comment')}</label>
          <Textarea id="fund-review-comment" value={text} maxLength={3000} disabled={pending} onChange={event => setText(event.target.value)} />
          {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
          <Button type="submit" disabled={!text.trim() || pending}>{t('comments.add')}</Button>
        </form>}
      </DialogContent>
    </Dialog>
  </>
}
