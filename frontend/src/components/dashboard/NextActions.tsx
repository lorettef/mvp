import { useTranslation } from 'react-i18next'
import { ArrowRight, CheckCircle2, Sparkles } from 'lucide-react'
import type { Task } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface SuggestedAction {
  id: string
  label: string
  target: string
}

export function NextActions({
  aiTasks,
  suggested,
  onOpen,
  emptyText,
}: {
  aiTasks: Task[]
  suggested: SuggestedAction[]
  onOpen: (target: string) => void
  emptyText: string
}) {
  const { t } = useTranslation()
  const hasAny = aiTasks.length > 0 || suggested.length > 0

  if (!hasAny) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="space-y-3">
      {aiTasks.length > 0 && (
        <ul className="space-y-2">
          {aiTasks.slice(0, 5).map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onOpen('tasks')}
                className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">{task.title}</span>
                <Badge variant="secondary" className="shrink-0">
                  {t('company.tasks.sourceAi')}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      {suggested.length > 0 && (
        <ul className="space-y-2">
          {suggested.map((action) => (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onOpen(action.target)}
                className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/40"
              >
                <CheckCircle2 className={cn('h-4 w-4 shrink-0 text-muted-foreground')} />
                <span className="min-w-0 flex-1 text-foreground">{action.label}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
