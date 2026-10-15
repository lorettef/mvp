import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyStatusItem } from '@/types/api'
import { PortfolioRevenueChart } from './PortfolioRevenueChart'
import { PnLEbitdaChart } from '@/components/company/PnLEbitdaChart'
import { TrendChart } from './TrendChart'
import { CompanyRevenueShareChart } from './CompanyRevenueShareChart'
import { CompanyRevenueComparisonChart } from './CompanyRevenueComparisonChart'
import { IndustryProfitabilityChart } from './IndustryProfitabilityChart'
import { PortfolioPerformanceStatusChart, PortfolioRunwayChart } from './PortfolioStatusCharts'
import { CompanyRevenueChart, CompanyUnitEconomicsTrendChart, CompanyRetentionTrendChart, CompanyCashFlowChart, CompanyEbitdaChart } from '@/components/company/CompanyProfileCharts'
import type { CashFlowMonth, Metric, PnLPeriod } from '@/types/api'

const company: CompanyStatusItem = {
  id: 'company', name: 'Компания', industry: 'saas', geography: null,
  businessModel: null, revenueGrowth: null, runwayMonths: null,
  status: 'on_track', latestRevenue: 100, latestPlanRevenue: 90,
  lastUpdate: '2026-09-01', health: 'healthy', attention: [], taskProgress: null,
  fact: { period: '2026-09-01', revenue: 100, newUnits: 10, arpu: 10, marketingSpend: 20,
    retentionRate: 0.9, cac: 2, ltv: 100, churn: 0.1 }, plan: null,
}
const points = [{ month: '2026-09', fact: 100, plan: 90 }]
const metric={...company.fact!,id:'m',companyId:company.id,type:'fact',activeUnits:1,comment:null,createdAt:'',updatedAt:''} as Metric

// Keep real ResponsiveContainer. Supply geometry and observer entries that
// jsdom cannot provide, then verify the resulting SVG actually changes size.
const observers: Array<{ target?: Element; callback: ResizeObserverCallback; disconnect: ReturnType<typeof vi.fn> }> = []
beforeEach(() => {
  observers.length = 0
  const original = Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this.classList.contains('recharts-responsive-container')
      ? new DOMRect(0, 0, 320, 240)
      : original.call(this)
  })
  vi.stubGlobal('ResizeObserver', class {
    callback: ResizeObserverCallback
    target?: Element
    disconnect = vi.fn()
    constructor(callback: ResizeObserverCallback) { this.callback = callback; observers.push(this) }
    observe(target: Element) { this.target = target }
    unobserve() {}
  })
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('analytics chart sizing', () => {
  it.each([
    ['portfolio', () => <PortfolioRevenueChart data={points} />, 256],
    ['pnl-ebitda', () => <PnLEbitdaChart periods={[{ period: '2026-09-01', plan: { ebitda: 100 }, fact: { ebitda: 90 } } as PnLPeriod]} />, 288],
    ['trend', () => <TrendChart data={points} />, 288],
    ['share', () => <CompanyRevenueShareChart companies={[company]} />, undefined],
    ['comparison', () => <CompanyRevenueComparisonChart companies={[company]} />, 300],
    ['industry', () => <IndustryProfitabilityChart data={[{ industry: 'saas', revenue: 100, totalOpex: 80,
      ebitda: 20, ebitdaMargin: 0.2, companiesTotal: 1, companiesIncluded: 1 }]} industryLabel={() => 'SaaS'} />, 240],
    ['status',()=> <PortfolioPerformanceStatusChart companies={[company]} />,288],
    ['runway',()=> <PortfolioRunwayChart companies={[{...company,runwayMonths:3}]} />,256],
    ['company revenue',()=> <CompanyRevenueChart metrics={[metric]} />,288],
    ['company unit economics',()=> <CompanyUnitEconomicsTrendChart metrics={[metric]} />,288],
    ['company retention',()=> <CompanyRetentionTrendChart metrics={[metric]} />,288],
    ['company cash flow',()=> <CompanyCashFlowChart months={[{period:'2026-09-01',netCashFlow:-1,closingBalance:10} as CashFlowMonth]} />,288],
    ['company EBITDA',()=> <CompanyEbitdaChart periods={[{period:'2026-09-01',fact:{ebitda:10},plan:null} as PnLPeriod]} />,288],
  ] as const)('%s uses a measurable wrapper and reacts to parent observation', (_name, chart, height) => {
    const { container, unmount } = render(chart())
    const responsive = container.querySelector('.recharts-responsive-container')!
    const wrapper = responsive.parentElement!
    expect(wrapper).toHaveClass('min-w-0', 'w-full')
    expect(responsive).toHaveStyle({ width: '100%', height: '100%' })
    if (height !== undefined) expect(wrapper).toHaveStyle({ height: `${height}px` })
    else expect(wrapper.style.aspectRatio).toBe('1 / 1')
    expect(observers).toHaveLength(1)
    expect(observers[0].target).toBe(responsive)
    const svg = responsive.querySelector('svg.recharts-surface')!
    expect(svg).toHaveAttribute('width', '320')
    expect(svg).toHaveAttribute('height', '240')
    act(() => observers[0].callback([
      { target: responsive, contentRect: new DOMRect(0, 0, 640, 240) } as ResizeObserverEntry,
    ], {} as ResizeObserver))
    expect(responsive.querySelector('svg.recharts-surface')).toHaveAttribute('width', '640')
    unmount()
    expect(observers[0].disconnect).toHaveBeenCalledOnce()
  })

  it('mounts after empty/loading data without inventing a chart for missing data', () => {
    const { container, rerender } = render(<PortfolioRevenueChart data={[]} />)
    expect(screen.getByText('Добавьте метрики, чтобы увидеть динамику выручки.')).toBeVisible()
    expect(observers).toHaveLength(0)
    rerender(<PortfolioRevenueChart data={points} />)
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('width', '320')
    expect(container.querySelector('svg.recharts-surface')).toHaveAttribute('height', '240')
  })

  it('keeps many-company scrolling local to the comparison chart', () => {
    const companies = Array.from({ length: 20 }, (_, index) => ({ ...company, id: String(index) }))
    const { container } = render(<CompanyRevenueComparisonChart companies={companies} />)
    const responsive = container.querySelector('.recharts-responsive-container')!
    expect(responsive.parentElement).toHaveStyle({ minWidth: '1880px' })
    expect(responsive.parentElement!.parentElement).toHaveClass('overflow-x-auto', 'min-w-0', 'w-full', 'max-w-full')
    expect(screen.getByRole('group', { name: 'План vs Факт по компаниям' })).toHaveAttribute('tabindex', '0')
  })

  it('bounds the responsive donut by its parent instead of enforcing a fixed square', () => {
    const { container } = render(<CompanyRevenueShareChart companies={[company]} />)
    const square = container.querySelector('.recharts-responsive-container')!.parentElement!
    expect(square.style.aspectRatio).toBe('1 / 1')
    expect(square.parentElement).toHaveClass('w-full', 'min-w-0', 'max-w-52')
    expect(square.parentElement).not.toHaveClass('w-52', 'h-52', 'shrink-0')
    expect(screen.getByRole('list', { name: 'Выручка и доли компаний' })).toHaveClass('min-w-0')
  })
})
