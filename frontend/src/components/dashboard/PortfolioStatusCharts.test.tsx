import { render,screen,within } from '@testing-library/react'
import { describe,it,expect,vi } from 'vitest'
import type { CompanyStatusItem } from '@/types/api'
import type { ReactElement } from 'react'
import { PortfolioPerformanceStatusChart,PortfolioRunwayChart } from './PortfolioStatusCharts'
import { performanceCounts,runwayCompanies } from '@/lib/portfolioStatus'

vi.mock('recharts',async()=>{
  const actual=await vi.importActual<typeof import('recharts')>('recharts')
  const {cloneElement}=await import('react')
  return {...actual,ResponsiveContainer:({children}:{children:ReactElement})=>cloneElement(children,{width:360,height:288})}
})
const companies=['on_track','behind','no_plan','no_data'].map((status,i)=>({id:String(i),name:`Company ${i}`,status,runwayMonths:[8,0,null,2][i]} as CompanyStatusItem))
describe('Filtered portfolio status charts',()=>{
  it('preserves four distinct statuses and real counts, including zero categories',()=>{
    expect(performanceCounts(companies).map(p=>p.count)).toEqual([1,1,1,1])
    const {rerender}=render(<PortfolioPerformanceStatusChart companies={companies} />)
    const list=screen.getByRole('list',{name:'Выполнение плана по компаниям'})
    for(const label of ['Выполняют план','Отстают от плана','Нет плана','Нет данных'])expect(within(list).getByText(`${label}: 1`)).toBeInTheDocument()
    rerender(<PortfolioPerformanceStatusChart companies={[companies[2]]} />)
    expect(within(list).getByText('Нет плана: 1')).toBeInTheDocument();expect(within(list).getByText('Отстают от плана: 0')).toBeInTheDocument()
  })
  it('sorts numeric runway lowest first, keeps real zero and excludes unavailable from bars',()=>{
    expect(runwayCompanies(companies).map(c=>c.id)).toEqual(['1','3','0'])
    render(<PortfolioRunwayChart companies={companies} />)
    expect(screen.getByText('Нет данных о runway: 1')).toBeInTheDocument()
    const list=screen.getByRole('list',{name:'Runway компаний — значения'})
    expect(within(list).getAllByRole('listitem').map(e=>e.textContent)).toEqual(['Company 1: 0 мес.','Company 3: 2 мес.','Company 0: 8 мес.','Company 2: Нет данных'])
  })
  it('accepts only current filtered companies for runway, with no stale copy',()=>{
    const {rerender}=render(<PortfolioRunwayChart companies={companies} />)
    rerender(<PortfolioRunwayChart companies={[companies[3]]} />)
    expect(screen.getByRole('list',{name:'Runway компаний — значения'})).toHaveTextContent('Company 3: 2 мес.')
    expect(screen.queryByText('Company 0: 8 мес.')).not.toBeInTheDocument()
  })
  it('handles empty portfolios without fake bars or runway zeros',()=>{
    const {container}=render(<><PortfolioPerformanceStatusChart companies={[]} /><PortfolioRunwayChart companies={[]} /></>)
    expect(container.querySelector('svg')).toBeNull();expect(screen.getByText('Нет данных')).toBeInTheDocument()
    expect(screen.queryByText('0 мес.')).not.toBeInTheDocument()
  })
})
