import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CorrectionButton } from './CorrectionButton'
import { formatCorrectionValue } from '@/lib/correctionFormatting'
import type { ReviewCorrection } from '@/types/api'
import i18n from '@/i18n'

const correction: ReviewCorrection = {
  id: 'c1', companyId: 'co', authorId: 'fund', authorName: 'Fund',
  targetType: 'metric_value', metricId: 'm1', field: 'revenue', indicatorKey: null,
  targetPeriod: null, targetScenario: null, sourceMetricId: null, sourceUpdatedAt: null,
  originalValue: '100', correctedValue: '95', currentSourceValue: '100', isStale: false,
  reason: 'Verified invoice', createdAt: '2026-01-01T00:00:00',
}

describe('CorrectionButton', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })

  it('keeps original primary, shows current overlay and sends only target/value/reason once', async () => {
    let resolve!: () => void
    const onCreate = vi.fn(() => new Promise<void>(done => { resolve = done }))
    render(<div><span>100 ₽</span><CorrectionButton label="Выручка, Факт" valueKey="revenue" currentValue="100"
      target={{ target_type: 'metric_value', metric_id: 'm1', field: 'revenue' }}
      corrections={[correction]} canCreate onCreate={onCreate} /></div>)
    expect(screen.getByText('100 ₽')).toBeInTheDocument()
    expect(screen.getByText(/Корректировка фонда: ₽95/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Скорректировать: Выручка, Факт' }))
    expect(screen.getByText(/Причина: Verified invoice/)).toBeInTheDocument()
    expect(screen.getAllByText(/Исходное значение: ₽100/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByRole('textbox', { name: 'Скорректированное значение' }), { target: { value: '90' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Причина' }), { target: { value: ' New evidence ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить корректировку' }))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(onCreate).toHaveBeenCalledWith({ target_type: 'metric_value', metric_id: 'm1', field: 'revenue', corrected_value: '90', reason: 'New evidence' })
    expect(screen.getByRole('button', { name: 'Добавить корректировку' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Добавить корректировку' }))
    expect(onCreate).toHaveBeenCalledOnce()
    resolve()
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Причина' })).toHaveValue(''))
  })

  it('shows stale history without an active corrected value and no Startup form', () => {
    render(<CorrectionButton label="Выручка" valueKey="revenue" currentValue="120"
      target={{ target_type: 'metric_value', metric_id: 'm1', field: 'revenue' }}
      corrections={[{ ...correction, isStale: true, currentSourceValue: '120' }]}
      canCreate={false} onCreate={vi.fn()} />)
    expect(screen.queryByText(/Корректировка фонда: ₽95/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'История корректировок: Выручка' }))
    expect(screen.getByText(/Причина: Verified invoice/)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Причина' })).not.toBeInTheDocument()
  })

  it('formats rates, money, counts and months for their targets', () => {
    const months = (value: string) => `${value} months`
    expect(formatCorrectionValue('0.75', 'retention_rate', months)).toContain('75')
    expect(formatCorrectionValue('100', 'revenue', months)).toContain('100')
    expect(formatCorrectionValue('7', 'new_units', months)).toBe('7')
    expect(formatCorrectionValue('12.5', 'payback_period', months)).toBe('12.5 months')
  })
})
