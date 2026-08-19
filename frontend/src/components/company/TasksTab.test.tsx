import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TasksTab } from './TasksTab'
import type { Task, ReadinessResponse } from '@/types/api'

function makeTask(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    companyId: 'comp1',
    title: 'Подготовить метрики',
    description: null,
    stage: 'metrics',
    status: 'pending',
    effectiveStatus: 'pending',
    dueDate: null,
    createdAt: '',
    updatedAt: '',
    ...over,
  }
}

function makeReadiness(over: Partial<ReadinessResponse> = {}): ReadinessResponse {
  return {
    companyId: 'comp1',
    readiness: 25,
    totalTasks: 4,
    doneTasks: 1,
    stages: [
      { stage: 'metrics', label: 'Подготовка метрик', total: 1, done: 1, percent: 100 },
      { stage: 'documents', label: 'Сбор документов', total: 1, done: 0, percent: 0 },
      { stage: 'negotiations', label: 'Переговоры', total: 1, done: 0, percent: 0 },
      { stage: 'presentation', label: 'Презентация', total: 1, done: 0, percent: 0 },
    ],
    risks: ['Сбор документов', 'Переговоры', 'Презентация'],
    summary: 'Готовность 25%. Основные риски: не завершены этапы Сбор документов, Переговоры, Презентация.',
    ...over,
  }
}

describe('TasksTab', () => {
  it('renders tasks with status badges grouped by stage', () => {
    render(
      <TasksTab
        tasks={[makeTask(), makeTask({ id: 't2', stage: 'documents', title: 'Собрать документы' })]}
        readiness={null}
        canEdit
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isPending={false}
      />
    )
    expect(screen.getByText('Подготовить метрики')).toBeInTheDocument()
    expect(screen.getByText('Собрать документы')).toBeInTheDocument()
    expect(screen.getAllByText('В ожидании').length).toBe(2)
    expect(screen.getByText('Подготовка метрик')).toBeInTheDocument()
    expect(screen.getByText('Сбор документов')).toBeInTheDocument()
  })

  it('renders readiness summary and stage progress', () => {
    render(
      <TasksTab
        tasks={[]}
        readiness={makeReadiness()}
        canEdit
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isPending={false}
      />
    )
    expect(screen.getByText('Готовность к продаже')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByText(/Готовность 25%/)).toBeInTheDocument()
  })

  it('creates a task with correct payload', () => {
    const onCreate = vi.fn()
    render(
      <TasksTab
        tasks={[]}
        readiness={null}
        canEdit
        onCreate={onCreate}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isPending={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Добавить задачу/ }))
    fireEvent.change(screen.getByLabelText('Название задачи'), {
      target: { value: 'Новая задача' },
    })
    fireEvent.change(screen.getByLabelText('Этап'), { target: { value: 'documents' } })
    fireEvent.change(screen.getByLabelText('Срок'), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(onCreate).toHaveBeenCalledWith({
      title: 'Новая задача',
      stage: 'documents',
      status: 'pending',
      due_date: '2026-12-31',
    })
  })

  it('advances status on button click', () => {
    const onUpdate = vi.fn()
    render(
      <TasksTab
        tasks={[makeTask()]}
        readiness={null}
        canEdit
        onCreate={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        isPending={false}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'В работу' }))
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'in_progress' })
    fireEvent.click(screen.getByRole('button', { name: 'Выполнено' }))
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'done' })
  })

  it('shows empty state and hides actions when canEdit=false', () => {
    const { rerender } = render(
      <TasksTab
        tasks={[]}
        readiness={null}
        canEdit
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isPending={false}
      />
    )
    expect(screen.getByText('Задачи ещё не добавлены.')).toBeInTheDocument()

    rerender(
      <TasksTab
        tasks={[makeTask()]}
        readiness={null}
        canEdit={false}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        isPending={false}
      />
    )
    expect(screen.queryByRole('button', { name: /Добавить задачу/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'В работу' })).not.toBeInTheDocument()
  })
})
