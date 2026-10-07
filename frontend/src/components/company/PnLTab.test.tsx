import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, afterEach } from 'vitest'
import i18n from '@/i18n'
import { PnLTab } from './PnLTab'
import type { PnLPeriod, PnLResponse, PnLScenario } from '@/types/api'

function scenario(type: 'plan' | 'fact', period = '2026-02-01', over: Partial<PnLScenario> = {}): PnLScenario {
  return { metricSource: { id: `metric-${type}`, period, type, newUnits: 7, arpu: 1234.56, revenue: 100000, marketingSpend: 876.54, retentionRate: 0.97, comment: 'original' },
    budgetSource: { id: `budget-${type}`, period, type, fot: 30000, marketing: 10000, development: 20000, gna: 5000 },
    revenue: 100000, fot: 30000, socialPayments: 9060, marketing: 10000, development: 20000, gna: 5000, totalOpex: 74060, ebitda: 25940, financialExpenses: type === 'fact' ? 1250 : null, netProfit: type === 'fact' ? 24690 : null, ebitdaMargin: 0.2594, netMargin: type === 'fact' ? 0.2469 : null, ...over }
}
function pair(period = '2026-02-01', plan: PnLScenario | null = scenario('plan', period), fact: PnLScenario | null = scenario('fact', period)): PnLPeriod { return { period, plan, fact } }
function data(periods = [pair()]): PnLResponse {
  return { companyId: 'c1', period: '2026-02-01', mrr: 999999, oneTimeRevenue: 0, revenue: 999999, fot: null, socialPayments: null, marketing: null, development: null, gna: null, totalOpex: null, ebitda: null, financialExpenses: 0, netProfit: null, profitTax: 0, ebitdaMargin: null, netMargin: null, summary: 'legacy mixed', months: [], periods }
}
const callbacks = () => ({ canEdit: true, onSaveMetric: vi.fn().mockResolvedValue({}), onDeleteMetric: vi.fn().mockResolvedValue({}), onSaveBudget: vi.fn().mockResolvedValue({}), onDeleteBudget: vi.fn().mockResolvedValue({}) })
const desktop = () => within(screen.getByRole('table', { name: 'P&L: месяцы, план и факт' }))
const mobile = () => within(screen.getByRole('table', { name: 'P&L: выбранный месяц, план и факт' }))
const cell = (metric: string, type = 'Факт', view = desktop()) => view.getByRole('button', { name: new RegExp(`^${metric} · .* · ${type} —`) })
const dialog = () => within(screen.getByRole('dialog'))
afterEach(async () => { if (i18n.language !== 'ru') await act(async () => { await i18n.changeLanguage('ru') }) })

describe('P&L paired matrix', () => {
  it('puts indicators in rows and chronological month groups with Plan/Fact columns; ignores legacy summary', () => {
    render(<PnLTab data={data([pair('2026-03-01'), pair('2026-01-01'), pair()])} />)
    const table = desktop()
    expect(table.getAllByRole('row')).toHaveLength(14)
    expect(table.getAllByRole('rowheader').map((x) => x.textContent)).toEqual(['Выручка','ФОТ','Соц. платежи','Маркетинг','Разработка','G&A','Итого OPEX','EBITDA','Финансовые расходы','Чистая прибыль','Маржа EBITDA','Маржа прибыли'])
    expect(table.getAllByRole('columnheader').slice(1,4).map((x) => x.textContent)).toEqual(['Январь 2026','Февраль 2026','Март 2026'])
    expect(table.getAllByRole('columnheader', { name: 'План' })).toHaveLength(3)
    expect(table.getAllByRole('columnheader', { name: 'Факт' })).toHaveLength(3)
    expect(screen.queryByText('legacy mixed')).not.toBeInTheDocument()
    expect(screen.queryByText(/999/)).not.toBeInTheDocument()
  })
  it.each(['plan', 'fact'] as const)('renders %s-only with missing as dash and real zero', (type) => {
    const s = scenario(type, undefined, { revenue: 0, ebitda: 0 })
    render(<PnLTab data={data([pair(undefined, type === 'plan' ? s : null, type === 'fact' ? s : null)])} />)
    const row = desktop().getByRole('rowheader', { name: 'Выручка' }).closest('tr')!
    expect(within(row).getByText('₽0')).toBeInTheDocument()
    expect(within(row).getByText('—')).toBeInTheDocument()
  })
  it('shows empty and loading states', () => {
    const r = render(<PnLTab />)
    expect(screen.getByText('Данные P&L ещё не рассчитаны.')).toBeInTheDocument()
    r.rerender(<PnLTab data={data([])} />)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    r.rerender(<PnLTab isLoading />)
    expect(screen.queryByText('Данные P&L ещё не рассчитаны.')).not.toBeInTheDocument()
  })
  it.each(['Соц. платежи','Итого OPEX','EBITDA','Финансовые расходы','Чистая прибыль','Маржа EBITDA','Маржа прибыли'])('never directly edits %s', (label) => {
    render(<PnLTab data={data()} {...callbacks()} />)
    const row = desktop().getByRole('rowheader', { name: label }).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    cells.forEach((x) => { fireEvent.doubleClick(x); fireEvent.keyDown(x,{ key: 'Enter' }) })
    expect(within(row).queryByRole('spinbutton')).not.toBeInTheDocument()
    cells.forEach((x) => expect(within(x).queryByRole('button')).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('explains before-tax profit accessibly', async () => {
    render(<PnLTab data={data()} />)
    await userEvent.click(desktop().getByRole('button', { name: 'Чистая прибыль' }))
    expect(screen.getByText('В текущей модели показатель рассчитывается до налога на прибыль.')).toBeInTheDocument()
  })
})

describe('Metric source editor', () => {
  it.each(['План', 'Факт'])('double-click %s Revenue opens the exact full source with raw inputs and immutable period/type', (type) => {
    render(<PnLTab data={data()} {...callbacks()} />)
    fireEvent.doubleClick(cell('Выручка',type))
    expect(dialog().getByText(new RegExp(`Источник: ${type} · Февраль 2026`))).toBeInTheDocument()
    expect(dialog().getByRole('spinbutton', { name: 'Новые платящие клиенты / юниты' })).toHaveValue(7)
    expect(dialog().getByRole('spinbutton', { name: 'Средняя выручка на клиента' })).toHaveValue(1234.56)
    expect(dialog().getByRole('spinbutton', { name: 'Расходы на привлечение / маркетинг' })).toHaveValue(876.54)
    expect(dialog().getByRole('spinbutton', { name: 'Удержание (%)' })).toHaveValue(97)
    expect(dialog().getByRole('textbox', { name: 'Комментарий' })).toHaveValue('original')
    expect(dialog().queryByRole('combobox')).not.toBeInTheDocument()
    expect(dialog().getAllByRole('spinbutton')).toHaveLength(5)
  })
  it.each(['Enter',' '])('supports %s', (key) => {
    render(<PnLTab data={data()} {...callbacks()} />)
    cell('Выручка','План').focus()
    expect(cell('Выручка','План')).toHaveFocus()
    fireEvent.keyDown(cell('Выручка','План'),{ key })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  it('validates and waits for save success; submits full source with edited comment', async () => {
    const props = callbacks()
    let finish!: () => void
    props.onSaveMetric.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve }))
    render(<PnLTab data={data()} {...props} />)
    fireEvent.doubleClick(cell('Выручка','План'))
    const arpu = dialog().getByRole('spinbutton', { name: 'Средняя выручка на клиента' })
    fireEvent.change(arpu,{ target: { value: '0' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Сохранить' }))
    expect(props.onSaveMetric).not.toHaveBeenCalled()
    expect(dialog().getByText('Введите число больше 0.')).toBeInTheDocument()
    fireEvent.change(arpu,{ target: { value: '1234.56' } })
    fireEvent.change(dialog().getByRole('textbox', { name: 'Комментарий' }),{ target: { value: 'edited' } })
    fireEvent.click(dialog().getByRole('button', { name: 'Сохранить' }))
    expect(props.onSaveMetric).toHaveBeenCalledWith({ period:'2026-02-01',type:'plan',new_units:7,arpu:1234.56,revenue:100000,marketing_spend:876.54,retention_rate:0.97,comment:'edited' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(dialog().getByRole('button', { name: 'Сохранить' })).toBeDisabled()
    finish()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it.each([null, ''])('preserves an untouched %s comment in the full source payload', async (comment) => {
    const props = callbacks()
    const fact = scenario('fact')
    fact.metricSource = { ...fact.metricSource!, comment }
    render(<PnLTab data={data([pair(undefined, null, fact)])} {...props} />)
    fireEvent.doubleClick(cell('Выручка'))
    fireEvent.click(dialog().getByRole('button', { name: 'Сохранить' }))
    expect(props.onSaveMetric).toHaveBeenCalledWith(expect.objectContaining({ comment }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
  it('keeps source on API failure and requires confirmation before deletion by id', async () => {
    const props = callbacks()
    props.onSaveMetric.mockRejectedValue(new Error('offline'))
    props.onDeleteMetric.mockRejectedValueOnce(new Error('delete offline'))
    render(<PnLTab data={data()} {...props} />)
    fireEvent.doubleClick(cell('Выручка','Факт'))
    fireEvent.click(dialog().getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    fireEvent.click(dialog().getByRole('button', { name: 'Удалить исходную запись' }))
    expect(props.onDeleteMetric).not.toHaveBeenCalled()
    fireEvent.click(dialog().getByRole('button', { name: 'Удалить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('delete offline')
    fireEvent.click(dialog().getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(props.onDeleteMetric).toHaveBeenCalledWith('metric-fact')
  })
})

describe('Budget source editor', () => {
  it.each([['ФОТ','План'],['ФОТ','Факт'],['Маркетинг','План'],['Разработка','Факт'],['G&A','План']])('%s/%s opens the entire matching budget', (label,type) => {
    render(<PnLTab data={data()} {...callbacks()} />)
    fireEvent.doubleClick(cell(label,type))
    expect(screen.getByRole('dialog', { name: 'Редактировать исходный бюджет' })).toBeInTheDocument()
    expect(dialog().getByText(new RegExp(`Источник: ${type}`))).toBeInTheDocument()
    for (const [name,value] of [['ФОТ',30000],['Маркетинг',10000],['Разработка',20000],['G&A',5000]] as const) expect(dialog().getByRole('spinbutton', { name })).toHaveValue(value)
    expect(dialog().queryByRole('combobox')).not.toBeInTheDocument()
  })
  it('validates, saves all budget inputs and supports cancel', async () => {
    const props = callbacks()
    render(<PnLTab data={data()} {...props} />)
    fireEvent.doubleClick(cell('ФОТ','План'))
    fireEvent.change(dialog().getByRole('spinbutton', { name:'ФОТ' }),{ target:{ value:'' } })
    fireEvent.click(dialog().getByRole('button', { name:'Сохранить' }))
    expect(dialog().getByText('Заполните обязательное поле.')).toBeInTheDocument()
    expect(props.onSaveBudget).not.toHaveBeenCalled()
    fireEvent.change(dialog().getByRole('spinbutton', { name:'ФОТ' }),{ target:{ value:'0' } })
    fireEvent.click(dialog().getByRole('button', { name:'Сохранить' }))
    expect(props.onSaveBudget).toHaveBeenCalledWith({ period:'2026-02-01',type:'plan',fot:0,marketing:10000,development:20000,gna:5000 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    fireEvent.doubleClick(cell('Маркетинг'))
    fireEvent.click(dialog().getAllByRole('button', { name:'Отмена' })[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('keeps budget open on save/delete errors; cancellation preserves it and deletion uses its id', async () => {
    const props = callbacks()
    props.onSaveBudget.mockRejectedValue(new Error('offline'))
    props.onDeleteBudget.mockRejectedValueOnce(new Error('delete offline'))
    render(<PnLTab data={data()} {...props} />)
    fireEvent.doubleClick(cell('ФОТ','План'))
    fireEvent.click(dialog().getByRole('button', { name:'Сохранить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    fireEvent.click(dialog().getByRole('button', { name:'Удалить исходную запись' }))
    expect(props.onDeleteBudget).not.toHaveBeenCalled()
    fireEvent.click(dialog().getAllByRole('button', { name:'Отмена' })[0])
    expect(screen.getByRole('dialog', { name:'Редактировать исходный бюджет' })).toBeInTheDocument()
    fireEvent.click(dialog().getByRole('button', { name:'Удалить исходную запись' }))
    fireEvent.click(dialog().getByRole('button', { name:'Удалить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('delete offline')
    fireEvent.click(dialog().getByRole('button', { name:'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(props.onDeleteBudget).toHaveBeenCalledWith('budget-plan')
  })
})

describe('Mobile and permissions', () => {
  it('selects newest month and changes to another using the same paired values', () => {
    render(<PnLTab data={data([pair('2026-01-01'),pair('2026-11-01',scenario('plan','2026-11-01'),null)])} {...callbacks()} />)
    expect(screen.getByRole('combobox', { name:'Период' })).toHaveValue('2026-11-01')
    expect(mobile().getByRole('columnheader', { name:'План' })).toBeInTheDocument()
    expect(mobile().getByRole('columnheader', { name:'Факт' })).toBeInTheDocument()
    expect(mobile().getAllByText('Редактировать')).toHaveLength(10)
    fireEvent.change(screen.getByRole('combobox'),{ target:{ value:'2026-01-01' } })
    fireEvent.click(mobile().getByRole('button', { name:/^Выручка · .* · Факт —/ }))
    expect(dialog().getByText('Источник: Факт · Январь 2026')).toBeInTheDocument()
  })
  it('has explicit Budget edit on mobile', () => {
    render(<PnLTab data={data()} {...callbacks()} />)
    fireEvent.click(mobile().getByRole('button', { name:/^ФОТ · .* · План —/ }))
    expect(screen.getByRole('dialog', { name:'Редактировать исходный бюджет' })).toBeInTheDocument()
  })
  it.each(['metric','budget'] as const)('explains missing %s without creating records', (kind) => {
    const props = callbacks()
    render(<PnLTab data={data([pair(undefined,null,scenario('fact',undefined,{ metricSource:null,budgetSource:null,revenue:null,fot:null }))])} {...props} />)
    fireEvent.doubleClick(cell(kind==='metric' ? 'Выручка' : 'ФОТ','План'))
    expect(screen.getByRole('status')).toHaveTextContent(kind==='metric' ? 'Исходные метрики за этот период отсутствуют.' : 'Бюджет за этот период отсутствует.')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(mobile().getByRole('button', { name:new RegExp(`^${kind==='metric'?'Выручка':'ФОТ'} · .* · Факт —`) }))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(props.onSaveMetric).not.toHaveBeenCalled()
    expect(props.onSaveBudget).not.toHaveBeenCalled()
  })
  it('observer has no source editing affordance in either presentation', () => {
    render(<PnLTab data={data()} {...callbacks()} canEdit={false} />)
    expect(screen.queryByRole('button', { name:/редактировать исходную запись/ })).not.toBeInTheDocument()
    const row = desktop().getByRole('rowheader', { name:'Выручка' }).closest('tr')!
    fireEvent.doubleClick(within(row).getAllByRole('cell')[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('localizes headers, editors and profit explanation in English', async () => {
    await i18n.changeLanguage('en')
    render(<PnLTab data={data()} {...callbacks()} />)
    const table = within(screen.getByRole('table', { name:'P&L: months, plan and fact' }))
    expect(table.getByRole('columnheader', { name:'February 2026' })).toBeInTheDocument()
    expect(table.getByRole('columnheader', { name:'Plan' })).toBeInTheDocument()
    fireEvent.doubleClick(table.getByRole('button', { name:/^Revenue · .* · Plan —/ }))
    expect(dialog().getByRole('textbox', { name:'Comment' })).toHaveValue('original')
  })
})
