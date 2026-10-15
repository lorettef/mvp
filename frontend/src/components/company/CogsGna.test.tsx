import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { Budget, PnLResponse, PnLScenario, UnitEconomicsResponse } from '@/types/api'
import { BudgetTab } from './BudgetTab'
import { BudgetSourceEditor } from './BudgetSourceEditor'
import { GnaInputHelper } from './GnaInputHelper'
import { PnLTab } from './PnLTab'
import { UnitEconomicsTab } from './UnitEconomicsTab'
import i18n from '@/i18n'

vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts')
  const { cloneElement } = await import('react')
  return { ...actual, ResponsiveContainer: ({ children }: { children: ReactElement }) => cloneElement(children, { width: 640, height: 288 }) }
})
const period = '2026-10-01'
const budget = (type: 'plan' | 'fact', cogs: number | null = 40000): Budget => ({ id: `budget-${type}`, companyId: 'c1', period, type, cogs, marketing: 10, development: 20, fot: 30, gna: 900, createdAt: '', updatedAt: '' })
const callback = () => vi.fn().mockResolvedValue({})
const amount = (name: string) => screen.getByRole('spinbutton', { name })
const change = (name: string, value: string) => fireEvent.change(amount(name), { target: { value } })
beforeEach(() => { void i18n.changeLanguage('ru') })

const sourceScenario = (type: 'plan' | 'fact', grossMargin: number | null = .6): PnLScenario => ({
  metricSource: { id: `metric-${type}`, period, type, newUnits: 10, arpu: 100, revenue: 100000, marketingSpend: 10, retentionRate: .9, comment: null },
  budgetSource: budget(type), revenue: 100000, cogs: 40000, grossProfit: grossMargin === null ? null : 60000, grossMargin,
  fot: 30, marketing: 10, development: 20, gna: 900, socialPayments: 9.06, totalOpex: 969.06, ebitda: 99030.94,
  financialExpenses: 0, netProfit: 99030.94, ebitdaMargin: .99, netMargin: .99,
})

describe('COGS Budget source contract', () => {
  it('requires COGS for creation and accepts a real zero, with all five stored fields', async () => {
    const save = callback()
    render(<BudgetSourceEditor initialPeriod={period} initialType="plan" onSave={save} onClose={vi.fn()} />)
    for (const label of ['Маркетинг', 'Разработка', 'ФОТ', 'G&A']) change(label, '0')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(save).not.toHaveBeenCalled()
    expect(amount('Себестоимость (COGS)')).toHaveAttribute('aria-invalid', 'true')
    change('Себестоимость (COGS)', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith({ period, type: 'plan', cogs: 0, marketing: 0, development: 0, fot: 0, gna: 0 })
  })
  it('allows legacy null COGS while editing OPEX, without inventing a cost', async () => {
    const save = callback()
    render(<BudgetSourceEditor source={budget('fact', null)} onSave={save} onClose={vi.fn()} />)
    expect(amount('Себестоимость (COGS)')).toHaveValue(null)
    change('Маркетинг', '12.34')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith({ period, type: 'fact', cogs: null, marketing: 12.34, development: 20, fot: 30, gna: 900 })
  })
  it.each(['', '-1', 'Infinity'])('does not erase known COGS with invalid input %s', raw => {
    const save = callback()
    render(<BudgetSourceEditor source={budget('fact')} onSave={save} onClose={vi.fn()} />)
    change('Себестоимость (COGS)', raw)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(save).not.toHaveBeenCalled()
  })
  it('rejects malformed browser input even when legacy COGS is optional', () => {
    const save = callback()
    render(<BudgetSourceEditor source={budget('fact', null)} onSave={save} onClose={vi.fn()} />)
    Object.defineProperty(amount('Себестоимость (COGS)'), 'validity', { configurable: true, value: { badInput: true } })
    fireEvent.input(amount('Себестоимость (COGS)'))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(save).not.toHaveBeenCalled()
  })
  it.each(['plan', 'fact'] as const)('inline %s COGS preserves complete source and counterpart, sends one request', async type => {
    const sources = [budget('plan'), budget('fact', null)]
    const save = callback()
    const view = render(<BudgetTab budgets={sources} canEdit onSubmit={save} onDelete={callback()} />)
    const table = within(screen.getByTestId('budget-desktop'))
    const row = table.getByRole('rowheader', { name: 'Себестоимость (COGS)' }).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    fireEvent.doubleClick(within(cells[type === 'plan' ? 0 : 1]).getAllByRole('button')[0])
    const input = table.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '50000.25' } })
    fireEvent.keyDown(input, { key: 'Enter' }); fireEvent.blur(input)
    await waitFor(() => expect(table.queryByRole('spinbutton')).not.toBeInTheDocument())
    expect(save).toHaveBeenCalledOnce()
    expect(save).toHaveBeenCalledWith({ period, type, cogs: 50000.25, marketing: 10, development: 20, fot: 30, gna: 900 })
    expect(within(cells[type === 'plan' ? 1 : 0]).getAllByRole('button')[0]).toHaveTextContent(type === 'plan' ? '—' : '₽40 000')
    view.rerender(<BudgetTab budgets={sources.map(s => s.type === type ? { ...s, cogs: 51000 } : s)} canEdit onSubmit={save} onDelete={callback()} />)
    expect(cells[type === 'plan' ? 0 : 1]).toHaveTextContent('₽51 000')
  })
  it('COGS source menu binds the exact scenario and warns about all five Budget fields', async () => {
    const remove = callback()
    render(<BudgetTab budgets={[budget('plan'), budget('fact')]} canEdit onSubmit={callback()} onDelete={remove} />)
    const row = within(screen.getByTestId('budget-desktop')).getByRole('rowheader', { name: 'Себестоимость (COGS)' }).closest('tr')!
    await userEvent.click(within(within(row).getAllByRole('cell')[0]).getByRole('button', { name: /^Действия/ }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Удалить запись' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/Будет удалена вся/)).toHaveTextContent('Себестоимость (COGS), ФОТ, Маркетинг, Разработка и G&A')
    await userEvent.click(dialog.getByRole('button', { name: 'Удалить' }))
    expect(remove).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith('budget-plan')
  })
})

describe('Derived gross values stay server-owned and read-only', () => {
  it.each([.6, -.5, null])('P&L displays server Gross Margin %s and protects both gross rows', margin => {
    const fact = sourceScenario('fact', margin)
    const data = { periods: [{ period, fact, plan: null }] } as PnLResponse
    const save = callback()
    render(<PnLTab data={data} canEdit onSaveMetric={save} onDeleteMetric={callback()} onSaveBudget={save} onDeleteBudget={callback()} />)
    const table = within(screen.getByTestId('pnl-desktop'))
    const gm = table.getByRole('rowheader', { name: 'Валовая маржа' }).closest('tr')!
    expect(gm).toHaveTextContent(margin === null ? '—' : margin < 0 ? '-50.0%' : '60.0%')
    for (const name of ['Валовая прибыль', 'Валовая маржа']) {
      const row = table.getByRole('rowheader', { name }).closest('tr')!
      for (const cell of within(row).getAllByRole('cell')) expect(within(cell).queryByRole('button')).not.toBeInTheDocument()
      expect(within(row).queryByRole('button', { name: /^Действия/ })).not.toBeInTheDocument()
      for (const cell of within(row).getAllByRole('cell')) { fireEvent.doubleClick(cell); fireEvent.keyDown(cell, { key: 'Enter' }) }
    }
    expect(table.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(save).not.toHaveBeenCalled()
  })
  it('P&L COGS inline edits the exact matching Budget, preserving its siblings', async () => {
    const save = callback(), fact = sourceScenario('fact')
    render(<PnLTab data={{ periods: [{ period, fact, plan: sourceScenario('plan') }] } as PnLResponse} canEdit onSaveBudget={save} onDeleteBudget={callback()} />)
    const table = within(screen.getByTestId('pnl-desktop'))
    const row = table.getByRole('rowheader', { name: 'Себестоимость (COGS)' }).closest('tr')!
    fireEvent.doubleClick(within(within(row).getAllByRole('cell')[1]).getAllByRole('button')[0])
    fireEvent.change(table.getByRole('spinbutton'), { target: { value: '0' } })
    fireEvent.keyDown(table.getByRole('spinbutton'), { key: 'Enter' })
    expect(save).toHaveBeenCalledWith({ period, type: 'fact', cogs: 0, marketing: 10, development: 20, fot: 30, gna: 900 })
    await waitFor(() => expect(table.queryByRole('spinbutton')).not.toBeInTheDocument())
  })
  it.each([.6, null])('Unit Economics reads canonical margin %s, with source and no edit action', margin => {
    const data = { ...sourceScenario('fact'), companyId: 'c1', sourceMetric: sourceScenario('fact').metricSource,
      grossMargin: margin, paybackPeriod: margin === null ? null : 16.67, retention: {}, alerts: [] } as unknown as UnitEconomicsResponse
    render(<UnitEconomicsTab data={data} canEdit onSaveSource={callback()} onDeleteSource={callback()} />)
    const card = screen.getByRole('button', { name: 'Валовая маржа' }).parentElement!.parentElement!
    expect(card).toHaveTextContent(margin === null ? '—' : '60.0%')
    expect(screen.getByText('Источник: Факт · Октябрь 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /редактировать.*маржа/i })).not.toBeInTheDocument()
    expect(screen.queryByText('75.0%')).not.toBeInTheDocument()
  })
})

describe('Smart G&A local calculator', () => {
  it.each([[undefined, 8], ['unknown', 8], ['fintech', 9], ['healthtech', 9], ['saas', 9]] as const)('uses administrative suggestions for %s', (industry, count) => {
    render(<GnaInputHelper industry={industry} onApply={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать по статьям' }))
    expect(screen.getAllByRole('spinbutton')).toHaveLength(count)
    expect(screen.getByText(/Детализация используется только/)).toBeInTheDocument()
    expect(screen.queryByText(/COGS|ФОТ|Маркетинг|Разработка/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Применить сумму' })).toBeDisabled()
  })
  it('validates custom name/amount, totals only selected suggestions, and applies once', () => {
    const apply = vi.fn()
    render(<GnaInputHelper onApply={apply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать по статьям' }))
    change('Бухгалтерия и аудит', '10.25')
    fireEvent.click(screen.getByRole('button', { name: 'Добавить свою статью' }))
    change('Сумма своей статьи 1', '2.5')
    expect(screen.getByRole('button', { name: 'Применить сумму' })).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Название своей статьи 1' }), { target: { value: 'Архив документов' } })
    change('Сумма своей статьи 1', '-1')
    expect(screen.getByRole('button', { name: 'Применить сумму' })).toBeDisabled()
    change('Сумма своей статьи 1', '2.5')
    expect(screen.getByRole('status')).toHaveTextContent('₽13')
    fireEvent.click(screen.getByRole('button', { name: 'Применить сумму' }))
    expect(apply).toHaveBeenCalledOnce()
    expect(apply).toHaveBeenCalledWith(12.75)
  })
  it('cancel leaves the aggregate unchanged, reopening starts blank and real zero is valid', () => {
    const apply = vi.fn()
    render(<GnaInputHelper onApply={apply} />)
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать по статьям' }))
    change('Юридические услуги', '99')
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(apply).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать по статьям' }))
    expect(amount('Юридические услуги')).toHaveValue(null)
    change('Юридические услуги', '0')
    fireEvent.click(screen.getByRole('button', { name: 'Применить сумму' }))
    expect(apply).toHaveBeenCalledWith(0)
  })
  it('Apply changes only local aggregate; Save sends only Budget amounts, never breakdown', async () => {
    const save = callback()
    render(<BudgetSourceEditor industry="fintech" source={budget('fact')} onSave={save} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Рассчитать по статьям' }))
    change('Комплаенс и регуляторные консультации', '123.45')
    fireEvent.click(screen.getByRole('button', { name: 'Применить сумму' }))
    expect(save).not.toHaveBeenCalled()
    expect(amount('G&A')).toHaveValue(123.45)
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(save).toHaveBeenCalledOnce())
    expect(save).toHaveBeenCalledWith({ period, type: 'fact', cogs: 40000, marketing: 10, development: 20, fot: 30, gna: 123.45 })
  })
})
