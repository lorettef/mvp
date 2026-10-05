import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { CompanyStatusItem, DashboardMetricSnapshot } from '@/types/api'
import { PortfolioPlanFactTable, PortfolioUnitEconomicsTable } from './PortfolioSummaryTables'

const fact: DashboardMetricSnapshot = {
  period: '2026-09-01', revenue: 1250000, newUnits: 125, arpu: 10000,
  marketingSpend: 900000, retentionRate: 0.8, churn: 0.075, ltv: 98765, cac: 321,
}
const plan: DashboardMetricSnapshot = {
  ...fact, revenue: 1400000, newUnits: 140, arpu: 11000, marketingSpend: 999999, cac: 456,
  ltv: 888888, churn: 0.5,
}
const alpha: CompanyStatusItem = {
  id: 'alpha', name: 'Summary Alpha', industry: 'saas', geography: null, businessModel: 'subscription',
  status: 'on_track', health: 'healthy', latestRevenue: 111, latestPlanRevenue: 222,
  revenueGrowth: null, runwayMonths: null, lastUpdate: '2026-10-01', attention: [], taskProgress: null,
  fact, plan,
}
const beta: CompanyStatusItem = { ...alpha, id: 'beta', name: 'Summary Beta', fact: { ...fact, period: '2026-08-01' }, plan: null }
const planTitle = 'План и факт по компаниям'
const unitTitle = 'Юнит-экономика компаний'
const region = (title: string) => screen.getByRole('region', { name: title })
const table = (title: string) => within(region(title)).getByRole('table')
const row = (title = planTitle, name = alpha.name) => within(table(title)).getByRole('row', { name: `Открыть: ${name}` })
const cells = (title = planTitle, name = alpha.name) => within(row(title, name)).getAllByRole('cell')
async function selectCompany(title: string, name: string) {
  const user = userEvent.setup()
  await user.click(within(region(title)).getByRole('combobox', { name: 'Компания' }))
  await user.click(await screen.findByRole('option', { name }))
}
async function openMetrics(title: string) {
  await userEvent.setup().click(within(region(title)).getByRole('button', { name: /^Показатели/ }))
}

describe('PortfolioPlanFactTable', () => {
  it('defaults to portfolio company rows, selects one and returns to all', async () => {
    const onOpen = vi.fn()
    render(<PortfolioPlanFactTable companies={[alpha, beta]} onOpen={onOpen} />)
    expect(within(region(planTitle)).getByRole('combobox')).toHaveTextContent('Общий портфель')
    expect(within(table(planTitle)).getAllByRole('row')).toHaveLength(3)
    await selectCompany(planTitle, alpha.name)
    expect(within(table(planTitle)).getAllByRole('row')).toHaveLength(2)
    expect(within(table(planTitle)).queryByText(beta.name)).not.toBeInTheDocument()
    await selectCompany(planTitle, 'Общий портфель')
    expect(within(table(planTitle)).getByText(beta.name)).toBeInTheDocument()
    expect(onOpen).not.toHaveBeenCalled()
  })

  it.each([
    [0, 'Выручка', '₽1 250 000', '₽1 400 000'],
    [1, 'Новые платящие клиенты', '125', '140'],
    [2, 'Средняя выручка на клиента', '₽10 000', '₽11 000'],
    [3, 'Стоимость привлечения одного клиента (CAC)', '₽321', '₽456'],
  ])('maps %s %s directly from matching snapshots', (index, _label, actual, planned) => {
    render(<PortfolioPlanFactTable companies={[alpha]} onOpen={vi.fn()} />)
    const cell = cells()[Number(index)]
    expect(cell).toHaveTextContent(`Факт ${actual}`)
    expect(cell).toHaveTextContent(`План ${planned}`)
    // Legacy revenue and marketing spend intentionally differ from snapshot values.
    expect(cell).not.toHaveTextContent('₽900 000')
  })

  it('keeps Fact when matching Plan is missing', () => {
    render(<PortfolioPlanFactTable companies={[beta]} onOpen={vi.fn()} />)
    cells(planTitle, beta.name).forEach(cell => expect(cell).toHaveTextContent('План —'))
    expect(cells(planTitle, beta.name)[0]).toHaveTextContent('Факт ₽1 250 000')
  })

  it('keeps companies without Fact and does not fall back to legacy revenue/period', () => {
    render(<PortfolioPlanFactTable companies={[{ ...alpha, fact: null, plan: null }]} onOpen={vi.fn()} />)
    cells().forEach(cell => {
      expect(cell).toHaveTextContent('Факт —')
      expect(cell).toHaveTextContent('План —')
      expect(cell).not.toHaveTextContent('₽0')
    })
    expect(within(row()).getByText('Нет фактических данных')).toBeInTheDocument()
  })

  it('shows null ARPU as missing while preserving genuine zeros in both snapshots', () => {
    const zeros = { ...fact, revenue: 0, newUnits: 0, arpu: null, cac: 0 }
    render(<PortfolioPlanFactTable companies={[{ ...alpha, fact: zeros, plan: zeros }]} onOpen={vi.fn()} />)
    for (const label of ['Факт', 'План']) {
      expect(cells()[0]).toHaveTextContent(`${label} ₽0`)
      expect(cells()[1]).toHaveTextContent(`${label} 0`)
      expect(cells()[2]).toHaveTextContent(`${label} —`)
      expect(cells()[3]).toHaveTextContent(`${label} ₽0`)
    }
  })

  it('uses Fact period instead of lastUpdate and explains business-model-dependent newUnits', async () => {
    render(<PortfolioPlanFactTable companies={[alpha]} onOpen={vi.fn()} />)
    expect(within(row()).getByText('Данные за Сентябрь 2026')).toBeInTheDocument()
    await userEvent.setup().click(within(table(planTitle)).getByRole('button', { name: 'Новые платящие клиенты' }))
    expect(await screen.findByText(/это могут быть покупатели, заказы, пользователи или контракты/)).toBeVisible()
  })

  it('hides selected metrics and prevents clearing the final metric', async () => {
    render(<PortfolioPlanFactTable companies={[alpha]} onOpen={vi.fn()} />)
    await openMetrics(planTitle)
    const user = userEvent.setup()
    for (const label of ['Новые платящие клиенты', 'Средняя выручка на клиента', 'Стоимость привлечения одного клиента (CAC)']) {
      await user.click(screen.getByRole('menuitemcheckbox', { name: label }))
    }
    expect(screen.getByRole('menuitemcheckbox', { name: 'Выручка' })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Выручка' }))
    await user.keyboard('{Escape}')
    expect(cells()).toHaveLength(1)
    expect(within(table(planTitle)).getAllByRole('columnheader')).toHaveLength(2)
    expect(within(region(planTitle)).getByRole('button', { name: /^Показатели/ })).toHaveTextContent('1 / 4')
    await openMetrics(planTitle)
    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Средняя выручка на клиента' }))
    await user.keyboard('{Escape}')
    expect(cells()).toHaveLength(2)
  })
})

describe('PortfolioUnitEconomicsTable', () => {
  it('shows Fact LTV/CAC/Churn with full terminology and fraction-to-percent formatting', () => {
    render(<PortfolioUnitEconomicsTable companies={[alpha]} onOpen={vi.fn()} />)
    for (const name of ['Пожизненная ценность клиента (LTV)', 'Стоимость привлечения клиента (CAC)', 'Отток клиентов (Churn)']) {
      expect(within(table(unitTitle)).getByRole('columnheader', { name })).toBeInTheDocument()
    }
    expect(cells(unitTitle)[0]).toHaveTextContent('₽98 765')
    expect(cells(unitTitle)[1]).toHaveTextContent('₽321')
    expect(cells(unitTitle)[2]).toHaveTextContent('7.5%')
    expect(row(unitTitle)).not.toHaveTextContent('План')
    expect(row(unitTitle)).not.toHaveTextContent('₽888 888')
  })

  it('preserves missing Fact, zero currency and zero churn', () => {
    const zeros = { ...alpha, fact: { ...fact, ltv: 0, cac: 0, churn: 0 } }
    render(<PortfolioUnitEconomicsTable companies={[zeros, { ...beta, fact: null }]} onOpen={vi.fn()} />)
    expect(cells(unitTitle)[0]).toHaveTextContent('₽0')
    expect(cells(unitTitle)[1]).toHaveTextContent('₽0')
    expect(cells(unitTitle)[2]).toHaveTextContent('0.0%')
    cells(unitTitle, beta.name).forEach(cell => expect(cell).toHaveTextContent('—'))
  })

  it('has its own company and metric selectors', async () => {
    render(<><PortfolioPlanFactTable companies={[alpha, beta]} onOpen={vi.fn()} />
      <PortfolioUnitEconomicsTable companies={[alpha, beta]} onOpen={vi.fn()} /></>)
    await selectCompany(unitTitle, beta.name)
    await openMetrics(unitTitle)
    await userEvent.setup().click(screen.getByRole('menuitemcheckbox', { name: 'Пожизненная ценность клиента (LTV)' }))
    await userEvent.setup().keyboard('{Escape}')
    expect(cells(unitTitle, beta.name)).toHaveLength(2)
    expect(within(table(planTitle)).getAllByRole('row')).toHaveLength(3)
    expect(cells()).toHaveLength(4)
    expect(within(region(planTitle)).getByRole('combobox')).toHaveTextContent('Общий портфель')
  })
})

describe('Summary shared behaviour', () => {
  it.each([PortfolioPlanFactTable, PortfolioUnitEconomicsTable])('resets an excluded local company without reviving it when global data returns', async Table => {
    const title = Table === PortfolioPlanFactTable ? planTitle : unitTitle
    const { rerender } = render(<Table companies={[alpha, beta]} onOpen={vi.fn()} />)
    await selectCompany(title, alpha.name)
    rerender(<Table companies={[beta]} onOpen={vi.fn()} />)
    expect(within(region(title)).getByRole('combobox')).toHaveTextContent('Общий портфель')
    expect(within(table(title)).getByText(beta.name)).toBeInTheDocument()
    rerender(<Table companies={[alpha, beta]} onOpen={vi.fn()} />)
    expect(within(table(title)).getAllByRole('row')).toHaveLength(3)
  })

  it('handles an empty filtered response and delegates reset to E5', async () => {
    const reset = vi.fn()
    render(<PortfolioPlanFactTable companies={[]} onOpen={vi.fn()} onResetFilters={reset} />)
    expect(within(region(planTitle)).getByText('По выбранным фильтрам компании не найдены.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(within(region(planTitle)).getByRole('combobox')).toBeDisabled()
    await userEvent.setup().click(within(region(planTitle)).getByRole('button', { name: 'Сбросить фильтры' }))
    expect(reset).toHaveBeenCalledTimes(1)
  })

  it.each([PortfolioPlanFactTable, PortfolioUnitEconomicsTable])('opens the company on full-row click and Enter/Space', Table => {
    const title = Table === PortfolioPlanFactTable ? planTitle : unitTitle
    const open = vi.fn()
    render(<Table companies={[alpha]} onOpen={open} />)
    fireEvent.click(cells(title)[0])
    expect(open).toHaveBeenLastCalledWith(alpha.id)
    fireEvent.keyDown(row(title), { key: 'Enter' })
    fireEvent.keyDown(row(title), { key: ' ' })
    expect(open).toHaveBeenCalledTimes(3)
    expect(row(title)).toHaveAttribute('tabindex', '0')
    expect(row(title)).toHaveClass('hover:bg-blue-50', 'cursor-pointer')
  })

  it('supports mobile card navigation and keeps metric help from opening the company', async () => {
    const open = vi.fn()
    render(<PortfolioPlanFactTable companies={[alpha]} onOpen={open} />)
    const card = within(region(planTitle)).getByRole('link', { name: `Открыть: ${alpha.name}` })
    fireEvent.click(within(card).getByText('Средняя выручка на клиента'))
    fireEvent.keyDown(card, { key: 'Enter' })
    fireEvent.keyDown(card, { key: ' ' })
    expect(open).toHaveBeenCalledTimes(3)
    open.mockClear()
    await userEvent.setup().click(within(card).getByRole('button', { name: 'Новые платящие клиенты' }))
    expect(await screen.findByText(/Значение показано без преобразований/)).toBeVisible()
    expect(open).not.toHaveBeenCalled()
  })
})
