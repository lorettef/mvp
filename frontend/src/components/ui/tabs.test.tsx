import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

// Radix Tabs activates a trigger on `mousedown` (a real click dispatches
// mousedown before click), so tests dispatch `fireEvent.mouseDown` to emulate
// a user click. Keyboard navigation (arrow keys / Home / End) is provided by
// Radix; it moves focus on the next macrotask, so keyboard tests flush timers
// inside `act` before asserting.

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('Tabs', () => {
  it('renders 3 triggers with given values', () => {
    render(
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
          <TabsTrigger value="budget">Бюджет</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    expect(screen.getByRole('tab', { name: 'Метрики' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Когорты' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Бюджет' })).toBeInTheDocument()
  })

  it('shows default tab content and hides others', () => {
    render(
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics">Metrics content</TabsContent>
        <TabsContent value="cohorts">Cohorts content</TabsContent>
      </Tabs>
    )
    expect(screen.getByText('Metrics content')).toBeInTheDocument()
    expect(screen.queryByText('Cohorts content')).not.toBeInTheDocument()
  })

  it('switches content on click', () => {
    render(
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics">Metrics content</TabsContent>
        <TabsContent value="cohorts">Cohorts content</TabsContent>
      </Tabs>
    )
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Когорты' }))
    expect(screen.getByText('Cohorts content')).toBeInTheDocument()
    expect(screen.queryByText('Metrics content')).not.toBeInTheDocument()
  })

  it('toggles aria-selected and data-state on click', () => {
    render(
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
        </TabsList>
      </Tabs>
    )
    const metricsTab = screen.getByRole('tab', { name: 'Метрики' })
    const cohortsTab = screen.getByRole('tab', { name: 'Когорты' })
    expect(metricsTab).toHaveAttribute('aria-selected', 'true')
    expect(cohortsTab).toHaveAttribute('aria-selected', 'false')
    expect(metricsTab).toHaveAttribute('data-state', 'active')

    fireEvent.mouseDown(cohortsTab)
    expect(cohortsTab).toHaveAttribute('aria-selected', 'true')
    expect(metricsTab).toHaveAttribute('aria-selected', 'false')
    expect(cohortsTab).toHaveAttribute('data-state', 'active')
    expect(metricsTab).toHaveAttribute('data-state', 'inactive')
  })

  it('calls onValueChange on click (controlled mode)', () => {
    const onValueChange = vi.fn()
    render(
      <Tabs value="metrics" onValueChange={onValueChange}>
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics">Metrics content</TabsContent>
        <TabsContent value="cohorts">Cohorts content</TabsContent>
      </Tabs>
    )
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Когорты' }))
    expect(onValueChange).toHaveBeenCalledWith('cohorts')
  })

  it('moves selection with arrow keys (keyboard navigation)', async () => {
    render(
      <Tabs defaultValue="metrics">
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
          <TabsTrigger value="budget">Бюджет</TabsTrigger>
        </TabsList>
        <TabsContent value="metrics">Metrics content</TabsContent>
        <TabsContent value="cohorts">Cohorts content</TabsContent>
        <TabsContent value="budget">Budget content</TabsContent>
      </Tabs>
    )

    const metricsTab = screen.getByRole('tab', { name: 'Метрики' })
    const cohortsTab = screen.getByRole('tab', { name: 'Когорты' })

    await act(async () => {
      metricsTab.focus()
      fireEvent.keyDown(metricsTab, { key: 'ArrowRight' })
      await flush()
    })

    expect(cohortsTab).toHaveAttribute('data-state', 'active')
    expect(metricsTab).toHaveAttribute('data-state', 'inactive')
    expect(cohortsTab).toHaveAttribute('aria-selected', 'true')
    expect(cohortsTab).toHaveFocus()
    expect(screen.getByText('Cohorts content')).toBeInTheDocument()
    expect(screen.queryByText('Metrics content')).not.toBeInTheDocument()
  })

  it('moves focus back with ArrowLeft and wraps with Home/End (keyboard navigation)', async () => {
    render(
      <Tabs defaultValue="cohorts">
        <TabsList>
          <TabsTrigger value="metrics">Метрики</TabsTrigger>
          <TabsTrigger value="cohorts">Когорты</TabsTrigger>
          <TabsTrigger value="budget">Бюджет</TabsTrigger>
        </TabsList>
      </Tabs>
    )

    const metricsTab = screen.getByRole('tab', { name: 'Метрики' })
    const cohortsTab = screen.getByRole('tab', { name: 'Когорты' })
    const budgetTab = screen.getByRole('tab', { name: 'Бюджет' })

    await act(async () => {
      cohortsTab.focus()
      fireEvent.keyDown(cohortsTab, { key: 'ArrowLeft' })
      await flush()
    })
    expect(metricsTab).toHaveAttribute('data-state', 'active')

    await act(async () => {
      fireEvent.keyDown(metricsTab, { key: 'End' })
      await flush()
    })
    expect(budgetTab).toHaveAttribute('data-state', 'active')

    await act(async () => {
      fireEvent.keyDown(budgetTab, { key: 'Home' })
      await flush()
    })
    expect(metricsTab).toHaveAttribute('data-state', 'active')
  })
})
