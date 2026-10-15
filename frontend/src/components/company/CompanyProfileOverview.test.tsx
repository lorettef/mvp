import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactElement } from 'react'
import type { CashFlowMonth, Cohort, Metric, PnLPeriod, PnLScenario, UnitEconomicsResponse } from '@/types/api'
import { companyMetricOverview, companyMarginSource, companyMetricTrend, companyCashPoints, companyEbitdaPoints } from '@/lib/companyOverview'
import { monthSeries } from '@/lib/kpi'
import { CompanyKpiStrip } from './CompanyKpiStrip'
import { CompanyProfileOverview } from './CompanyProfileOverview'
import { CompanyCashFlowChart, CompanyCohortChart, CompanyEbitdaChart, CompanyRetentionTrendChart, CompanyRevenueChart, CompanyUnitEconomicsTrendChart, CompanyTrendTooltip } from './CompanyProfileCharts'
import i18n from '@/i18n'

vi.mock('recharts',async()=>{
  const actual=await vi.importActual<typeof import('recharts')>('recharts')
  const {cloneElement}=await import('react')
  return {...actual,ResponsiveContainer:({children}:{children:ReactElement})=>cloneElement(children,{width:360,height:288})}
})
const metric=(period:string,type:'fact'|'plan',revenue:number):Metric=>({
  id:period+type,companyId:'c1',period,type,revenue,newUnits:10,arpu:900,marketingSpend:10,retentionRate:.85,
  churn:.123,cac:777,ltv:8888,activeUnits:100,comment:null,createdAt:'',updatedAt:'',
})
const scenario=(ebitda:number|null,ebitdaMargin:number|null):PnLScenario=>({
  metricSource:null,budgetSource:null,revenue:null,fot:null,socialPayments:null,marketing:null,development:null,gna:null,
  totalOpex:null,ebitda,financialExpenses:null,netProfit:null,ebitdaMargin,netMargin:null,
})
const periods:PnLPeriod[]=[{period:'2026-11-01',fact:null,plan:scenario(40,.4)},
  {period:'2026-10-01',fact:scenario(-10,-.1),plan:scenario(20,.2)}]
const rows=[metric('2026-10-01','fact',120),metric('2026-09-01','fact',100),metric('2026-10-01','plan',110),metric('2026-11-01','plan',300)]
const unit={runwayMonths:4,sourceMetric:rows[0]} as unknown as UnitEconomicsResponse
const cohort={id:'cohort',period:'2026-10-01',type:'fact',size:10,retentionM1:.85,retentionM2:0,retentionM3:null} as Cohort
const cash=[{period:'2026-11-01',netCashFlow:-30,closingBalance:70},{period:'2026-10-01',netCashFlow:0,closingBalance:100}] as CashFlowMonth[]
beforeEach(()=>{void i18n.changeLanguage('ru')})

describe('Company overview source semantics',()=>{
  it('uses latest Fact, same-period Plan and a safe percent growth rather than Unit absolute delta',()=>{
    const result=companyMetricOverview(rows)
    expect(result.current?.period).toBe('2026-10-01')
    expect(result.revenue).toBe(120);expect(result.growth).toBe(20);expect(result.status).toBe('on_track')
    expect(companyMetricOverview([rows[0],{...rows[1],revenue:0}]).growth).toBeNull()
  })
  it('never compares unrelated periods; distinguishes missing Fact, missing Plan and behind',()=>{
    expect(companyMetricOverview([rows[0],rows[3]]).status).toBe('no_plan')
    expect(companyMetricOverview([rows[3]]).status).toBe('no_data')
    expect(companyMetricOverview([rows[0],{...rows[2],revenue:130}]).status).toBe('behind')
    expect(companyMetricOverview([metric('2026-10-01','fact',0),metric('2026-10-01','plan',0)]).status).toBe('on_track')
  })
  it('prefers paired Fact EBITDA margin, with explicitly identifiable Plan fallback; ignores legacy summaries',()=>{
    expect(companyMarginSource(periods)).toEqual({period:'2026-10-01',type:'fact',value:-.1})
    expect(companyMarginSource([{...periods[0],plan:scenario(0,0)}])).toEqual({period:'2026-11-01',type:'plan',value:0})
    expect(companyMarginSource([])).toBeNull()
  })
  it('renders exactly six safe desktop cards with period, status, health, runway and margin',()=>{
    render(<CompanyKpiStrip metrics={rows} health={{companyId:'c1',status:'attention',signals:[],summary:'Проверьте расходы'}} unit={unit} periods={periods} />)
    const strip=screen.getByRole('group',{name:'Ключевые показатели компании'})
    expect(strip.children).toHaveLength(6)
    expect(strip).toHaveClass('min-[1366px]:grid-cols-6')
    for(const card of strip.children)expect(card).toHaveClass('min-w-0')
    for(const value of ['₽120','+20.0%','Выполняет план','Требует внимания','4 мес.','-10.0%'])expect(within(strip).getByText(value)).toBeInTheDocument()
    expect(within(strip).queryByText('Компании в портфеле')).not.toBeInTheDocument()
  })
  it('does not silently replace an unavailable latest Fact margin with an older Fact',()=>{
    const latest={...periods[0],fact:scenario(null,null)}
    expect(companyMarginSource([periods[1],latest])).toEqual({period:'2026-11-01',type:'plan',value:.4})
    expect(companyMarginSource([{...latest,plan:null}])).toBeNull()
  })
  it('keeps unavailable distinct from zero and labels Plan-only margin and revenue',()=>{
    const {rerender}=render(<CompanyKpiStrip />)
    expect(screen.getByRole('group',{name:'Ключевые показатели компании'})).not.toHaveTextContent('0%')
    rerender(<CompanyKpiStrip metrics={[metric('2026-11-01','plan',0)]} periods={[{...periods[0],plan:scenario(0,0)}]} />)
    expect(screen.getByText('₽0')).toBeInTheDocument();expect(screen.getByText('0.0%')).toBeInTheDocument()
    expect(screen.getAllByText('Ноябрь 2026 · План')).toHaveLength(3)
    expect(screen.getByText('Нет данных')).toBeInTheDocument()
  })
})

describe('Profile chart data',()=>{
  it('bounds long tooltip labels and removes inactive tooltip content after viewport or data changes',()=>{
    const props={payload:[{name:'Очень длинная стоимость привлечения клиента (CAC)',value:0}],label:'2026-10',percent:false}
    const {container,rerender}=render(<CompanyTrendTooltip {...props} active={false} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<CompanyTrendTooltip {...props} active />)
    expect(screen.getByText(/Стоимость|стоимость/)).toHaveTextContent('₽0')
    expect(container.firstChild).toHaveClass('max-w-64','[overflow-wrap:anywhere]')
    rerender(<CompanyTrendTooltip {...props} active percent />)
    expect(screen.getByText(/0.0%/)).toBeInTheDocument()
  })
  it('Revenue aligns Plan/Fact by month without dropping zero or fabricating missing scenarios',()=>{
    expect(monthSeries([metric('2026-10-01','fact',0),rows[3]])).toEqual([
      {month:'2026-10',fact:0,plan:null},{month:'2026-11',fact:null,plan:300},
    ])
    const {container}=render(<CompanyRevenueChart metrics={rows} />)
    expect(screen.getByText('Факт')).toBeInTheDocument();expect(screen.getByText('План')).toBeInTheDocument()
    expect(container.querySelector('.recharts-line')).toBeInTheDocument()
  })
  it('CAC/LTV reads canonical server values, excludes future Plan from Fact trend and uses full labels',()=>{
    expect(companyMetricTrend(rows,['cac','ltv'])).toMatchObject({type:'fact',data:[
      {month:'2026-09',first:777,second:8888},{month:'2026-10',first:777,second:8888},
    ]})
    render(<CompanyUnitEconomicsTrendChart metrics={rows} />)
    expect(screen.getByText('Стоимость привлечения клиента (CAC)')).toBeInTheDocument()
    expect(screen.getByText('Пожизненная ценность клиента (LTV)')).toBeInTheDocument()
  })
  it('Retention and Churn preserve different canonical values, percentages, zero and null',()=>{
    const values=[{...rows[0],retentionRate:0,churn:null}] as unknown as Metric[]
    expect(companyMetricTrend(values,['retentionRate','churn']).data[0]).toMatchObject({first:0,second:null})
    expect(companyMetricTrend(rows,['retentionRate','churn']).data[0]).toMatchObject({first:.85,second:.123})
    render(<CompanyRetentionTrendChart metrics={rows} />)
    expect(screen.getByText('Удержание клиентов')).toBeInTheDocument();expect(screen.getByText('Отток клиентов (Churn)')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
  it('Plan-only metric trends are explicitly labelled Plan',()=>{
    const {container}=render(<CompanyUnitEconomicsTrendChart metrics={[rows[3]]} />)
    expect(screen.getByText('План')).toBeInTheDocument()
    expect(container.querySelectorAll('.recharts-line-dot')).toHaveLength(2)
  })
  it('EBITDA reads only independent paired periods, including future Plan and negative/zero',()=>{
    expect(companyEbitdaPoints(periods)).toEqual([{month:'2026-10',fact:-10,plan:20},{month:'2026-11',fact:null,plan:40}])
    const {container}=render(<CompanyEbitdaChart periods={periods} />)
    expect(container.querySelectorAll('.recharts-line')).toHaveLength(2)
  })
  it('Cash Flow uses chronological netCashFlow and closingBalance, including negatives, without Plan/Fact',()=>{
    expect(companyCashPoints(cash)).toEqual([{month:'2026-10',first:0,second:100},{month:'2026-11',first:-30,second:70}])
    render(<CompanyCashFlowChart months={cash} />)
    expect(screen.getByText('Чистый денежный поток')).toBeInTheDocument();expect(screen.getByText('Остаток денежных средств')).toBeInTheDocument()
    expect(screen.queryByText('Факт')).not.toBeInTheDocument();expect(screen.queryByText('План')).not.toBeInTheDocument()
  })
  it('Cohort heatmap preserves M-age semantics, chronological rows and unknown vs real zero',()=>{
    render(<CompanyCohortChart cohorts={[cohort,{...cohort,id:'earlier',period:'2026-09-01',type:'plan'}]} />)
    const table=screen.getByRole('table',{name:'Удержание когорт по возрасту'})
    expect(within(table).getAllByRole('rowheader')[0]).toHaveTextContent('Сентябрь 2026')
    expect(within(table).getByRole('columnheader',{name:'M12'})).toBeInTheDocument()
    expect(within(table).getAllByText('85.0%')).toHaveLength(2)
    expect(within(table).getAllByText('0.0%')).toHaveLength(2)
    expect(within(table).getAllByText('—').length).toBeGreaterThan(1)
    expect(table.parentElement).toHaveClass('overflow-auto','min-w-0','w-full')
  })
  it.each(['revenue','unit','retention','cohort','ebitda','cashflow'])('%s has an honest empty state',kind=>{
    const charts={revenue:<CompanyRevenueChart metrics={[]} />,unit:<CompanyUnitEconomicsTrendChart metrics={[]} />,
      retention:<CompanyRetentionTrendChart metrics={[]} />,cohort:<CompanyCohortChart cohorts={[]} />,ebitda:<CompanyEbitdaChart periods={[]} />,cashflow:<CompanyCashFlowChart months={[]} />}
    render(charts[kind as keyof typeof charts]);expect(screen.getByText('Нет данных')).toBeInTheDocument()
  })
  it('keeps six slots and isolates Cash Flow errors from revenue and other available sources',()=>{
    const source=<T,>(data:T)=>({data,isLoading:false,isError:false,error:null,refetch:vi.fn()})
    const props={metrics:source(rows),cohorts:source([cohort]),pnl:source({periods,months:[]}),cashflow:{...source(undefined),isError:true,error:new Error('Cash Flow offline')},
      health:source(undefined),unit:source(undefined)}
    render(<CompanyProfileOverview {...props as unknown as Parameters<typeof CompanyProfileOverview>[0]} />)
    const grid=screen.getByRole('group',{name:'Графики компании'})
    expect(grid.children).toHaveLength(6);expect(grid).toHaveClass('min-[1366px]:grid-cols-3')
    expect(within(grid).getByRole('alert')).toHaveTextContent('Cash Flow offline')
    expect(within(grid).getAllByText('Факт').length).toBeGreaterThan(0)
    expect(within(grid).getByRole('heading',{name:'Выручка План/Факт'})).toBeInTheDocument()
  })
})
