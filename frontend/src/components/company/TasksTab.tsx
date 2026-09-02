import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task, TaskCreate, TaskUpdate, TaskStage, ReadinessResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2 } from 'lucide-react'

const STAGES: TaskStage[] = ['metrics', 'documents', 'negotiations', 'presentation']

const STATUS_BADGE_CLASS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/15 text-blue-500',
  done: 'bg-emerald-500/15 text-emerald-500',
  overdue: 'bg-destructive/15 text-destructive',
}

interface TasksTabProps {
  tasks: Task[]
  readiness: ReadinessResponse | null
  canEdit: boolean
  onCreate: (d: TaskCreate) => void
  onUpdate: (taskId: string, d: TaskUpdate) => void
  onDelete: (taskId: string) => void
  isPending: boolean
}

export function TasksTab({
  tasks,
  readiness,
  canEdit,
  onCreate,
  onUpdate,
  onDelete,
  isPending,
}: TasksTabProps) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', stage: 'metrics' as TaskStage, dueDate: '' })

  const STATUS_LABELS: Record<string, string> = {
    pending: t('company.tasks.status.pending'),
    in_progress: t('company.tasks.status.inProgress'),
    done: t('company.tasks.status.done'),
    overdue: t('company.tasks.status.overdue'),
  }

  const STAGE_LABELS: Record<string, string> = {
    metrics: t('company.tasks.stageLabel.metrics'),
    documents: t('company.tasks.stageLabel.documents'),
    negotiations: t('company.tasks.stageLabel.negotiations'),
    presentation: t('company.tasks.stageLabel.presentation'),
  }

  const handleCreate = () => {
    onCreate({
      title: form.title,
      stage: form.stage,
      status: 'pending',
      due_date: form.dueDate || undefined,
    })
  }

  const byStage = (stage: string) => tasks.filter((t) => t.stage === stage)

  return (
    <div className="space-y-6">
      {readiness && (
        <Card className="border bg-card/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-foreground">{t('company.tasks.readiness')}</h3>
              <span className="text-3xl font-bold text-foreground">{readiness.readiness}%</span>
            </div>
            <p className="text-sm text-muted-foreground">{readiness.summary}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {readiness.stages.map((s) => (
                <div key={s.stage} className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-lg font-semibold text-foreground mt-1">{s.percent}%</p>
                  <p className="text-xs text-muted-foreground">{s.done}/{s.total}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border bg-card/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground">{t('company.tasks.title')}</h3>
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('company.tasks.add')}
              </Button>
            )}
          </div>

          {showForm && canEdit && (
            <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  placeholder={t('company.tasks.name')}
                  aria-label={t('company.tasks.name')}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                />
                <select
                  aria-label={t('company.tasks.stage')}
                  value={form.stage}
                  onChange={(e) => setForm({ ...form, stage: e.target.value as TaskStage })}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  {STAGES.map((s) => (
                    <option key={s} value={s}>
                      {STAGE_LABELS[s]}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  aria-label={t('company.tasks.due')}
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                />
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" disabled={!form.title.trim() || isPending} onClick={handleCreate}>
                  {isPending ? t('common.saving') : t('common.save')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          )}

          {STAGES.map((stage) => {
            const stageTasks = byStage(stage)
            if (stageTasks.length === 0) return null
            return (
              <div key={stage} className="mb-5 last:mb-0">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {STAGE_LABELS[stage]}
                </h4>
                <div className="space-y-2">
                  {stageTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            {t('company.tasks.dueLabel', { date: task.dueDate })}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={STATUS_BADGE_CLASS[task.effectiveStatus] ?? ''}>
                          {STATUS_LABELS[task.effectiveStatus] ?? task.effectiveStatus}
                        </Badge>
                        {canEdit && task.status !== 'done' && (
                          <>
                            {task.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onUpdate(task.id, { status: 'in_progress' })}
                              >
                                {t('company.tasks.toWork')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onUpdate(task.id, { status: 'done' })}
                            >
                              {t('company.tasks.done')}
                            </Button>
                          </>
                        )}
                        {canEdit && (
                          <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-8">{t('company.tasks.empty')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
