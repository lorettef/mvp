import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, it, expect, vi } from 'vitest'
import { UnitEconomicsTab } from './UnitEconomicsTab'
import userEvent from '@testing-library/user-event'
import i18n from '@/i18n'
import type { UnitEconomicsResponse } from '@/types/api'

function makeData(over: Partial<UnitEconomicsResponse> = {}): UnitEconomicsResponse {
  return {
    companyId: 'comp1',
    sourceMetric: { id: 'source-1', period: '2026-02-01', type: 'fact', newUnits: 10, arpu: 150, revenue: 120000, marketingSpend: 10000, retentionRate: 0.97, comment: 'Keep comment' },
    revenue: 120000,
    cac: 1000,
    ltv: 5000,
    churn: 0.03,
    ltvCac: 5.0,
    runwayMonths: 15.0,
    paybackPeriod: 12.0,
    romi: 4.0,
    cash: 300000,
    monthlyBurn: 20000,
    magicNumber: 3.5,
    revenueGrowth: 20000,
    marketingSpend: 4000,
    retention: { m1: 0.8, m3: 0.6, m6: 0.5, m12: 0.4 },
    alerts: ['✅ LTV/CAC = 5.00 — отличный показатель.'],
    ...over,
  }
}

describe('UnitEconomicsTab', () => {
  beforeEach(async () => { await i18n.changeLanguage('ru') })
  it('renders LTV/CAC, Magic Number, Runway values', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText('Соотношение LTV/CAC')).toBeInTheDocument()
    expect(screen.getByText('5.00')).toBeInTheDocument() // ltv_cac
    expect(screen.getByText('Magic Number')).toBeInTheDocument()
    expect(screen.getByText('3.50')).toBeInTheDocument() // magic_number
    expect(screen.getByText('Запас денежных средств (Runway)')).toBeInTheDocument()
    expect(screen.getByText('15.0 мес.')).toBeInTheDocument()
  })

  it('explains Churn without changing its value', async () => {
    render(<UnitEconomicsTab data={makeData()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Отток клиентов (Churn)' }))
    expect(await screen.findByText(/Доля клиентов, которые перестали пользоваться продуктом/)).toBeVisible()
    expect(screen.getAllByText('3.0%')).toHaveLength(2)
  })

  it('renders retention M1/M3/M6/M12', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText('M1')).toBeInTheDocument()
    expect(screen.getByText('80.0%')).toBeInTheDocument()
    expect(screen.getByText('60.0%')).toBeInTheDocument()
    expect(screen.getByText('50.0%')).toBeInTheDocument()
    expect(screen.getByText('40.0%')).toBeInTheDocument()
  })

  it('renders Payback and ROMI cards', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText('Срок окупаемости (Payback)')).toBeInTheDocument()
    expect(screen.getByText('12.0 мес.')).toBeInTheDocument()
    expect(screen.getByText('Рентабельность маркетинга (ROMI)')).toBeInTheDocument()
    expect(screen.getByText('400.0%')).toBeInTheDocument()
  })

  it('renders alerts', () => {
    render(<UnitEconomicsTab data={makeData()} />)
    expect(screen.getByText(/LTV\/CAC = 5\.00/)).toBeInTheDocument()
  })

  it('shows — for missing values (no NaN/Infinity)', () => {
    render(
      <UnitEconomicsTab
        data={makeData({ ltvCac: null, runwayMonths: null, magicNumber: null })}
      />
    )
    expect(screen.getAllByText('—').length).toBe(3)
    expect(document.body.textContent).not.toContain('NaN')
    expect(document.body.textContent).not.toContain('Infinity')
  })

  it('shows skeleton when loading', () => {
    render(<UnitEconomicsTab data={makeData()} isLoading />)
    expect(screen.queryByText('Юнит-экономика')).not.toBeInTheDocument()
  })

  const editable = () => ({ canEdit: true, onSaveSource: vi.fn().mockResolvedValue(undefined), onDeleteSource: vi.fn().mockResolvedValue(undefined) })
  const editor = () => screen.getByRole('dialog', { name: 'Редактировать исходные данные' })
  const open = async () => {
    await userEvent.setup().click(screen.getByRole('button', { name: 'Редактировать исходные данные' }))
    return editor()
  }

  it('explains terminology and calculated semantics, including LTV/CAC', async () => {
    render(<UnitEconomicsTab data={makeData()} />)
    for (const label of ['Пожизненная ценность клиента (LTV)', 'Стоимость привлечения клиента (CAC)', 'Отток клиентов (Churn)']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('Показатели рассчитываются из Метрик, Когорт, Бюджета и Финансирования.')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Соотношение LTV/CAC' }))
    expect(await screen.findByText('Соотношение пожизненной ценности клиента к стоимости его привлечения.')).toBeVisible()
  })

  it.each(['fact', 'plan'] as const)('shows the actual %s source', (type) => {
    const data = makeData()
    data.sourceMetric!.type = type
    render(<UnitEconomicsTab data={data} />)
    expect(screen.getByText(`Источник: ${type === 'fact' ? 'Факт' : 'План'} · Февраль 2026`)).toBeInTheDocument()
  })

  it.each(['Выручка', 'Стоимость привлечения клиента (CAC)', 'Пожизненная ценность клиента (LTV)', 'Отток клиентов (Churn)'])('opens the same source on double-click of %s', (metric) => {
    render(<UnitEconomicsTab data={makeData()} {...editable()} />)
    fireEvent.doubleClick(screen.getByRole('button', { name: `${metric} — редактировать исходные данные` }))
    expect(editor()).toBeInTheDocument()
    expect(within(editor()).getByText('Источник: Факт · Февраль 2026')).toBeInTheDocument()
  })

  it.each(['{Enter}', ' '])('opens the source with keyboard %s', async (key) => {
    render(<UnitEconomicsTab data={makeData()} {...editable()} />)
    screen.getByRole('button', { name: 'Выручка — редактировать исходные данные' }).focus()
    await userEvent.setup().keyboard(key)
    expect(editor()).toBeInTheDocument()
  })

  it('opens via explicit mobile action with exact raw values and immutable period/type', async () => {
    render(<UnitEconomicsTab data={makeData()} {...editable()} />)
    const dialog = await open()
    const fields = within(dialog)
    expect(fields.getByRole('spinbutton', { name: 'Новые платящие клиенты / юниты' })).toHaveValue(10)
    expect(fields.getByRole('spinbutton', { name: 'Средняя выручка на клиента' })).toHaveValue(150)
    expect(fields.getByRole('spinbutton', { name: 'Выручка' })).toHaveValue(120000)
    expect(fields.getByRole('spinbutton', { name: 'Расходы на привлечение / маркетинг' })).toHaveValue(10000)
    expect(fields.getByRole('spinbutton', { name: 'Удержание (%)' })).toHaveValue(97)
    expect(dialog.querySelector('select, input[type="date"], input[type="month"]')).toBeNull()
    expect(fields.getAllByRole('spinbutton')).toHaveLength(5)
  })

  it.each(['Новые платящие клиенты / юниты', 'Средняя выручка на клиента', 'Выручка', 'Расходы на привлечение / маркетинг', 'Удержание (%)'])('rejects empty %s instead of sending zero', async (label) => {
    const props = editable()
    const user = userEvent.setup()
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    const dialog = await open()
    const input = within(dialog).getByRole('spinbutton', { name: label })
    await user.clear(input)
    await user.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(props.onSaveSource).not.toHaveBeenCalled()
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Заполните обязательное поле.')
    expect(input).toHaveFocus()
  })

  it.each([
    ['Новые платящие клиенты / юниты', '-1'], ['Новые платящие клиенты / юниты', '1.5'],
    ['Средняя выручка на клиента', '0'], ['Выручка', '-1'], ['Расходы на привлечение / маркетинг', '-1'],
    ['Удержание (%)', '-1'], ['Удержание (%)', '101'],
  ])('rejects invalid %s=%s', async (label, value) => {
    const props = editable()
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    const dialog = await open()
    const input = within(dialog).getByRole('spinbutton', { name: label })
    fireEvent.change(input, { target: { value } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(props.onSaveSource).not.toHaveBeenCalled()
  })

  it('sends raw inputs and retention fraction, preserves comment and closes only on success', async () => {
    const props = editable()
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    const dialog = await open()
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Удержание (%)' }), { target: { value: '82' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(props.onSaveSource).toHaveBeenCalledTimes(1)
    expect(props.onSaveSource).toHaveBeenCalledWith({ period: '2026-02-01', type: 'fact', new_units: 10, arpu: 150, revenue: 120000, marketing_spend: 10000, retention_rate: 0.82, comment: 'Keep comment' })
  })

  it('keeps the editor and entered data on save error', async () => {
    const props = editable()
    props.onSaveSource.mockRejectedValue({ response: { data: { detail: 'Request denied' } } })
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    const dialog = await open()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось сохранить исходные данные: Request denied')
    expect(editor()).toBeInTheDocument()
  })

  it('keeps the Plan source tuple immutable on save', async () => {
    const props = editable()
    const data = makeData()
    data.sourceMetric!.type = 'plan'
    render(<UnitEconomicsTab data={data} {...props} />)
    await open()
    fireEvent.click(within(editor()).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(props.onSaveSource).toHaveBeenCalledTimes(1))
    expect(props.onSaveSource.mock.calls[0][0]).toMatchObject({ period: '2026-02-01', type: 'plan' })
  })

  it('requires ARPU for a legacy source with missing ARPU', async () => {
    const props = editable()
    const data = makeData()
    data.sourceMetric!.arpu = null
    render(<UnitEconomicsTab data={data} {...props} />)
    await open()
    fireEvent.click(within(editor()).getByRole('button', { name: 'Сохранить' }))
    expect(screen.getByRole('spinbutton', { name: 'Средняя выручка на клиента' })).toHaveAccessibleDescription('Заполните обязательное поле.')
    expect(props.onSaveSource).not.toHaveBeenCalled()
  })

  it.each(['0', '100'])('accepts retention boundary %s without editing derived values', async (value) => {
    const props = editable()
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    await open()
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Удержание (%)' }), { target: { value } })
    fireEvent.click(within(editor()).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(props.onSaveSource).toHaveBeenCalledTimes(1))
    expect(props.onSaveSource.mock.calls[0][0].retention_rate).toBe(Number(value) / 100)
  })

  it('prevents duplicate save and dismissal while a request is pending', async () => {
    let resolve!: () => void
    const props = editable()
    props.onSaveSource.mockImplementation(() => new Promise<void>((done) => { resolve = done }))
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    await open()
    const save = within(editor()).getByRole('button', { name: 'Сохранить' })
    fireEvent.click(save)
    fireEvent.click(save)
    await userEvent.setup().keyboard('{Escape}')
    expect(props.onSaveSource).toHaveBeenCalledTimes(1)
    expect(editor()).toBeInTheDocument()
    expect(save).toBeDisabled()
    resolve()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('requires a separate delete confirmation, cancels safely and deletes the exact source id', async () => {
    const props = editable()
    const user = userEvent.setup()
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    const dialog = await open()
    await user.click(within(dialog).getByRole('button', { name: 'Удалить исходную запись' }))
    let confirmation = screen.getByRole('dialog', { name: 'Удалить данные за Февраль 2026?' })
    expect(props.onDeleteSource).not.toHaveBeenCalled()
    await user.click(within(confirmation).getByText('Отмена', { selector: 'button' }))
    expect(props.onDeleteSource).not.toHaveBeenCalled()
    await user.click(within(editor()).getByRole('button', { name: 'Удалить исходную запись' }))
    confirmation = screen.getByRole('dialog', { name: 'Удалить данные за Февраль 2026?' })
    await user.click(within(confirmation).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(props.onDeleteSource).toHaveBeenCalledTimes(1)
    expect(props.onDeleteSource).toHaveBeenCalledWith('source-1')
  })

  it('keeps deletion confirmation on API error', async () => {
    const props = editable()
    props.onDeleteSource.mockRejectedValue({ response: { data: { detail: 'Delete denied' } } })
    render(<UnitEconomicsTab data={makeData()} {...props} />)
    await open()
    fireEvent.click(within(editor()).getByRole('button', { name: 'Удалить исходную запись' }))
    const dialog = screen.getByRole('dialog', { name: 'Удалить данные за Февраль 2026?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Не удалось удалить исходную запись: Delete denied')
  })

  it('hides edit/delete for observer, while help and values remain available', () => {
    const props = editable()
    render(<UnitEconomicsTab data={makeData()} {...props} canEdit={false} />)
    expect(screen.queryByRole('button', { name: /редактировать исходные данные/i })).not.toBeInTheDocument()
    fireEvent.doubleClick(screen.getByText('Стоимость привлечения клиента (CAC)'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Соотношение LTV/CAC' })).toBeInTheDocument()
  })

  it('removes edit actions when the refreshed source disappears', () => {
    const props = editable()
    const { rerender } = render(<UnitEconomicsTab data={makeData()} {...props} />)
    expect(screen.getByRole('button', { name: 'Редактировать исходные данные' })).toBeInTheDocument()
    rerender(<UnitEconomicsTab data={makeData({ sourceMetric: null })} {...props} />)
    expect(screen.queryByRole('button', { name: /редактировать исходные данные/i })).not.toBeInTheDocument()
  })

  it('keeps all summary cards and retention read-only and never renders derived inputs', async () => {
    render(<UnitEconomicsTab data={makeData()} {...editable()} />)
    for (const label of ['Соотношение LTV/CAC', 'Magic Number', 'Запас денежных средств (Runway)', 'Срок окупаемости (Payback)', 'Рентабельность маркетинга (ROMI)', 'Отток клиентов (Churn)']) {
      fireEvent.doubleClick(screen.getByRole('button', { name: label }))
    }
    fireEvent.doubleClick(screen.getByText('M1'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    const dialog = await open()
    for (const label of ['LTV', 'CAC', 'Churn', 'LTV/CAC', 'Runway', 'Payback', 'ROMI', 'Magic Number']) {
      expect(within(dialog).queryByRole('spinbutton', { name: new RegExp(label) })).not.toBeInTheDocument()
    }
  })

  it('uses EN terminology and source editor labels', async () => {
    await i18n.changeLanguage('en')
    render(<UnitEconomicsTab data={makeData()} {...editable()} />)
    expect(screen.getByText('Customer lifetime value (LTV)')).toBeInTheDocument()
    expect(screen.getByText('Customer acquisition cost (CAC)')).toBeInTheDocument()
    expect(screen.getByText('Source: Fact · February 2026')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit source data' }))
    expect(screen.getByRole('dialog', { name: 'Edit source data' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Retention (%)' })).toHaveValue(97)
  })
})
