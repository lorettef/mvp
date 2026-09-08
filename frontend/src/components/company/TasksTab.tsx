import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task, TaskCreate, TaskUpdate, TaskStage, TaskPriority, ReadinessResponse } from '@/types/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/ui/date-picker'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge, type StatusTone } from '@/components/shared/status-badge'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Plus, Trash2, Sparkles, Pencil } from 'lucide-react'

const STAGES: TaskStage[] = ['metrics', 'documents', 'negotiations', 'presentation']

const statusTone: Record<string, StatusTone> = {
  pending: 'neutral',
  in_progress: 'info',
  done: 'success',
  overdue: 'danger',
}

const priorityTone: Record<TaskPriority, StatusTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'info',
}

interface TasksTabProps {
  tasks: Task[]
  readiness: ReadinessResponse | null
  canEdit: boolean
  onCreate: (d: TaskCreate) => Promise<unknown>
  onUpdate: (taskId: string, d: TaskUpdate) => void
  onDelete: (taskId: string) => void
  isPending: boolean
  onGenerateTasks: () => void
  isGenerating: boolean
}

export function TasksTab({
  tasks,
  readiness,
  canEdit,
  onCreate,
  onUpdate,
  onDelete,
  isPending,
  onGenerateTasks,
  isGenerating,
}: TasksTabProps) {
  const { t } = useTranslation()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', stage: 'metrics' as TaskStage, dueDate: '' })
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', status: 'pending' as Task['status'], priority: '' as TaskPriority | '' })
  const creatingRef = useRef(false)

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

  const PRIORITY_LABELS: Record<TaskPriority, string> = {
    high: t('company.tasks.priorityLabel.high'),
    medium: t('company.tasks.priorityLabel.medium'),
    low: t('company.tasks.priorityLabel.low'),
  }

  const handleCreate = async () => {
    // Re-entrancy guard: двойной клик до re-render React не должен отправить
    // второй запрос (флаг ставится синхронно, до первого await).
    if (creatingRef.current) return
    creatingRef.current = true
    try {
      await onCreate({
        title: form.title,
        stage: form.stage,
        status: 'pending',
        due_date: form.dueDate || undefined,
      })
      // Только при успехе сбрасываем форму — иначе повторный Save создал бы дубликат.
      setForm({ title: '', stage: 'metrics', dueDate: '' })
    } catch {
      // Ошибка уже показана глобальным обработчиком; оставляем ввод для повтора.
    } finally {
      creatingRef.current = false
    }
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setEditForm({
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority ?? '',
    })
  }

  const handleSaveEdit = () => {
    if (!editingTask) return
    onUpdate(editingTask.id, {
      title: editForm.title,
      description: editForm.description,
      status: editForm.status,
      priority: editForm.priority || null,
    })
    setEditingTask(null)
  }

  const byStage = (stage: string) => tasks.filter((t) => t.stage === stage)

  return (
    <div className="space-y-6">
      {readiness && (
        <Card className="border bg-card">
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

      <Card className="border bg-card">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-foreground">{t('company.tasks.title')}</h3>
            {canEdit && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onGenerateTasks}
                  disabled={isGenerating}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  {isGenerating ? t('company.tasks.generating') : t('company.tasks.generate')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
                  <Plus className="w-4 h-4 mr-2" />
                  {t('company.tasks.add')}
                </Button>
              </div>
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
                <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as TaskStage })}>
                  <SelectTrigger aria-label={t('company.tasks.stage')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <DatePicker
                  aria-label={t('company.tasks.due')}
                  value={form.dueDate}
                  onChange={(dueDate) => setForm({ ...form, dueDate })}
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
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                            {task.source === 'ai_recommendation' && (
                              <Badge variant="secondary" className="shrink-0">
                                <Sparkles className="w-3 h-3 mr-1" />
                                {t('company.tasks.sourceAi')}
                              </Badge>
                            )}
                          </div>
                          {task.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {task.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            {task.priority && (
                              <StatusBadge tone={priorityTone[task.priority]} dot={false}>
                                {PRIORITY_LABELS[task.priority]}
                              </StatusBadge>
                            )}
                            {task.metric && (
                              <Badge variant="outline" className="shrink-0">
                                {t('company.tasks.metric')}: {task.metric}
                              </Badge>
                            )}
                            {task.dueDate && (
                              <span className="text-xs text-muted-foreground">
                                {t('company.tasks.dueLabel', { date: task.dueDate })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge tone={statusTone[task.effectiveStatus] ?? 'neutral'}>
                            {STATUS_LABELS[task.effectiveStatus] ?? task.effectiveStatus}
                          </StatusBadge>
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
                            <>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(task)} aria-label={t('company.tasks.edit')}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => onDelete(task.id)} aria-label={t('common.delete')}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
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

      <Dialog open={editingTask !== null} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('company.tasks.editTask')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-task-title">{t('company.tasks.name')}</Label>
              <Input
                id="edit-task-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-task-description">{t('company.tasks.description')}</Label>
              <Textarea
                id="edit-task-description"
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('company.tasks.stage')}</Label>
                <Select
                  value={editingTask?.stage ?? 'metrics'}
                  onValueChange={(v) => onUpdate(editingTask!.id, { stage: v as TaskStage })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('company.tasks.priority')}</Label>
                <Select
                  value={editForm.priority}
                  onValueChange={(v) => setEditForm({ ...editForm, priority: v as TaskPriority })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {(['high', 'medium', 'low'] as TaskPriority[]).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              {t('common.cancel')}
            </Button>
            <Button disabled={!editForm.title.trim()} onClick={handleSaveEdit}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
