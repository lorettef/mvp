import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getErrorMessage } from '@/lib/toastError'

interface QueryStateProps {
  /** Show a skeleton placeholder while the query is in flight. */
  isLoading?: boolean
  /** Show an inline error card instead of the tab body. */
  isError?: boolean
  /** The query error — message extracted via getErrorMessage(). */
  error?: unknown
  /** Retry callback (e.g. query.refetch); renders a "Повторить" button. */
  onRetry?: () => void
  /** Show an explicit empty-state text instead of the tab body. */
  isEmpty?: boolean
  /** Empty-state text; defaults to "Нет данных". */
  emptyText?: string
  children: ReactNode
}

/**
 * Unified query state wrapper for tabs/pages: renders a skeleton while
 * loading, an inline error card with a retry button on failure, an explicit
 * empty-state text when there is no data, and the children otherwise.
 * Prevents failed queries from rendering as silently-empty tabs.
 */
export function QueryState({
  isLoading = false,
  isError = false,
  error,
  onRetry,
  isEmpty = false,
  emptyText,
  children,
}: QueryStateProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return (
      <div data-testid="query-state-loading" className="space-y-4 p-4" role="status">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <div
        data-testid="query-state-error"
        role="alert"
        className="flex flex-col items-center justify-center rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-10 text-center"
      >
        <AlertCircle className="w-10 h-10 text-destructive mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-destructive">{getErrorMessage(error)}</p>
        {onRetry && (
          <Button type="button" size="sm" variant="outline" onClick={onRetry} className="mt-4">
            <RefreshCw className="w-4 h-4 mr-2" aria-hidden="true" />
            {t('common.retry')}
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div
        data-testid="query-state-empty"
        className="rounded-lg border border-border bg-muted/30 px-6 py-10 text-center"
      >
        <p className="text-sm text-muted-foreground">{emptyText ?? t('common.noData')}</p>
      </div>
    )
  }

  return <>{children}</>
}
