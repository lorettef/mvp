import { fireEvent, render, screen } from '@testing-library/react'
import { Building2 } from 'lucide-react'
import { describe, expect, it } from 'vitest'
import { MetricCard } from './metric-card'

describe('MetricCard sizing contract', () => {
  it.each([
    ['Выручка всех компаний выбранного портфеля за отчётный месяц', '₽999\u00a0999\u00a0999\u00a0999\u00a0999'],
    ['Revenue of all companies in the selected portfolio for the reporting month', '-999,999,999,999,999'],
    ['Рост', '-123.4%'],
    ['Средний runway', '—'],
    ['Average runway', '1234.5 mo.'],
  ])('keeps the full label and value for %s in a shrinkable compact card', (label, value) => {
    const { container } = render(<MetricCard compact label={label} value={value} icon={<Building2 />} />)
    const renderedValue = screen.getByText(value, { normalizer: (text) => text })
    expect(screen.getByText(label)).toBeVisible()
    expect(renderedValue).toBeVisible()
    expect(container.firstElementChild).toHaveClass('min-w-0')
    // Text may wrap at the card boundary; neither the value nor label is truncated.
    expect(renderedValue).toHaveClass('[overflow-wrap:anywhere]')
    expect(screen.getByText(label)).not.toHaveClass('truncate')
  })

  it('retains accessible help with a long label and unavailable value', async () => {
    const label = 'Выручка всех компаний выбранного портфеля за отчётный месяц'
    render(<MetricCard compact label={label} value="—" description="Нет фактической выручки за выбранный период." icon={<Building2 />} />)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(await screen.findByRole('dialog', { name: label })).toHaveTextContent('Нет фактической выручки')
    expect(screen.getByText('—')).toBeVisible()
  })

  it('allows currency groups to wrap without changing the complete value text', () => {
    const value = '₽999\u00a0999\u00a0999\u00a0999\u00a0999'
    render(<MetricCard compact label="Выручка" value={value} />)
    const renderedValue = screen.getByText(value, { normalizer: (text) => text })
    expect(renderedValue.textContent).toBe(value)
    expect(renderedValue.querySelectorAll('wbr')).toHaveLength(4)
  })

  it('bounds the sparkline and retains values, trend and Plan/Fact content', () => {
    const { container } = render(<MetricCard compact label="Выручка" value="₽999 999 999 999"
      sparkline={[10, 15, 12]} delta={-20} context="За предыдущий месяц"
      planFact={{ plan: '₽999 999 999 998', fact: '₽999 999 999 999' }} />)
    const svg = container.querySelector('svg[viewBox="0 0 96 32"]')!
    expect(svg).toHaveClass('w-full')
    expect(svg.parentElement).toHaveClass('max-w-full', 'min-w-0')
    expect(screen.getByText('За предыдущий месяц')).toBeVisible()
    expect(screen.getByText('-20%')).toBeVisible()
    expect(screen.getByText('₽999 999 999 998')).toBeVisible()
    expect(screen.getAllByText('₽999 999 999 999')).toHaveLength(2)
  })
})
