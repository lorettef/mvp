import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './tabs'

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
    fireEvent.click(screen.getByRole('tab', { name: 'Когорты' }))
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

    fireEvent.click(cohortsTab)
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
    fireEvent.click(screen.getByRole('tab', { name: 'Когорты' }))
    expect(onValueChange).toHaveBeenCalledWith('cohorts')
  })
})
