import { useState } from 'react'
import { act, fireEvent, render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { qk } from '@/lib/queryKeys'
import type { BudgetUpsert, MetricBulkUpsert } from '@/types/api'
import { DataEntryWizard } from './DataEntryWizard'

const http=vi.hoisted(()=>({put:vi.fn()}))
vi.mock('@/api/client',()=>({api:{put:http.put}}))
const clients: QueryClient[]=[]
function Host({companyId='c1',tenantKey='org1'}:{companyId?:string;tenantKey?:string}) {
  const [open,setOpen]=useState(false)
  return <><button onClick={()=>setOpen(true)}>Начало ввода данных</button>{open&&<DataEntryWizard companyId={companyId} tenantKey={tenantKey} onClose={()=>setOpen(false)} />}</>
}
function setup() {
  const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}})
  clients.push(client)
  const tree=(props={})=><QueryClientProvider client={client}><Host {...props} /></QueryClientProvider>
  const view=render(tree())
  fireEvent.click(screen.getByRole('button',{name:'Начало ввода данных'}))
  return {...view,client,tree}
}
const dialog=()=>within(screen.getByRole('dialog',{name:'Начало ввода данных'}))
const metricRows=()=>dialog().getAllByRole('group',{name:/^Метрика — месяц/})
const budgetRows=()=>dialog().getAllByRole('group',{name:/^Бюджет — месяц/})
function fillMetric(row=metricRows()[0]) {
  const r=within(row)
  for(const [label,value] of [['Новые платящие клиенты / юниты','10'],['Средняя выручка на клиента','100.25'],['Выручка','0'],['Расходы на привлечение / маркетинг','0'],['Удержание (%)','85']]) fireEvent.change(r.getByRole('spinbutton',{name:label}),{target:{value}})
}
function fillBudget(row=budgetRows()[0]) {
  for(const [label,value] of [['Себестоимость (COGS)','0'],['Маркетинг','0'],['Разработка','1.25'],['ФОТ','0'],['G&A','0']]) fireEvent.change(within(row).getByRole('spinbutton',{name:label}),{target:{value}})
}
async function toCohort() {
  fillMetric()
  fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
  await dialog().findByRole('heading',{name:'Когорта'})
}
async function toBudget() {
  await toCohort()
  fireEvent.change(dialog().getByRole('spinbutton',{name:'Размер когорты'}),{target:{value:'10'}})
  fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
  await dialog().findByRole('heading',{name:'Бюджет'})
}
async function chooseMonth(row:HTMLElement,label:string) {
  fireEvent.click(within(row).getByRole('button',{name:'Период'}))
  fireEvent.click(screen.getByRole('button',{name:label}))
}
beforeEach(async()=>{
  vi.useFakeTimers({toFake:['Date']})
  vi.setSystemTime(new Date('2026-10-15T12:00:00'))
  await i18n.changeLanguage('ru')
  http.put.mockReset().mockResolvedValue({data:[]})
})
afterEach(()=>{cleanup();clients.splice(0).forEach(c=>c.clear());vi.useRealTimers()})

describe('Data entry wizard shell and Metric step',()=>{
  it('opens on Metric, exactly one month, invalid Next disabled, future steps are not clickable; pristine Cancel closes',()=>{
    setup()
    expect(metricRows()).toHaveLength(1)
    expect(within(metricRows()[0]).getByRole('button',{name:'Период'})).toHaveTextContent('Октябрь 2026')
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    expect(dialog().getByRole('list',{name:'Шаги ввода данных'}).querySelector('[aria-current="step"]')).toHaveTextContent('Метрика')
    expect(dialog().queryByRole('button',{name:'Когорта'})).not.toBeInTheDocument()
    fireEvent.click(dialog().getAllByRole('button',{name:'Отмена'})[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('adds an empty next calendar month requiring explicit scenario, and removes only added rows',()=>{
    setup();fillMetric()
    fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}))
    expect(metricRows()).toHaveLength(2)
    expect(within(metricRows()[1]).getByRole('button',{name:'Период'})).toHaveTextContent('Ноябрь 2026')
    expect(within(metricRows()[1]).getByRole('combobox',{name:'Тип'})).toHaveValue('')
    expect(within(metricRows()[1]).getAllByRole('spinbutton').every(e=>(e as HTMLInputElement).value==='')).toBe(true)
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    expect(within(metricRows()[0]).queryByRole('button',{name:'Удалить месяц'})).not.toBeInTheDocument()
    fireEvent.click(within(metricRows()[1]).getByRole('button',{name:'Удалить месяц'}))
    expect(metricRows()).toHaveLength(1)
  })
  it('Escape closes the nested month picker while keeping the wizard and its draft',async()=>{
    setup();fillMetric()
    fireEvent.click(within(metricRows()[0]).getByRole('button',{name:'Период'}))
    const month=screen.getByRole('button',{name:'Октябрь 2026'})
    month.focus()
    fireEvent.keyDown(month,{key:'Escape'})
    await waitFor(()=>expect(screen.queryByRole('button',{name:'Октябрь 2026'})).not.toBeInTheDocument())
    expect(screen.queryByRole('dialog',{name:'Закрыть ввод?'})).not.toBeInTheDocument()
    expect(within(metricRows()[0]).getByRole('spinbutton',{name:'Удержание (%)'})).toHaveValue(85)
    expect(http.put).not.toHaveBeenCalled()
  })
  it('blocks duplicate period/type with an explanation, allowing the counterpart scenario',async()=>{
    setup();fillMetric()
    fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}));fillMetric(metricRows()[1])
    await chooseMonth(metricRows()[1],'Октябрь 2026')
    fireEvent.change(within(metricRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'fact'}})
    expect(dialog().getAllByRole('alert')[0]).toHaveTextContent('Этот месяц и тип уже есть')
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    fireEvent.change(within(metricRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'plan'}})
    expect(dialog().getByRole('button',{name:'Далее'})).toBeEnabled()
    expect(http.put).not.toHaveBeenCalled()
  })
  it.each([['Новые платящие клиенты / юниты','1.5'],['Средняя выручка на клиента','0'],['Выручка',''],['Расходы на привлечение / маркетинг','-1'],['Удержание (%)','101']] as const)('validates %s without empty-to-zero coercion', (label,value)=>{
    setup();fillMetric()
    const input=within(metricRows()[0]).getByRole('spinbutton',{name:label})
    fireEvent.change(input,{target:{value}})
    expect(input).toHaveAttribute('aria-invalid','true')
    expect(input).toHaveAccessibleDescription()
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    expect(http.put).not.toHaveBeenCalled()
  })
  it('sends one chronological bulk request with exact mixed Plan/Fact raw inputs and no derived fields',async()=>{
    const {client}=setup();fillMetric()
    await chooseMonth(metricRows()[0],'Ноябрь 2026')
    fireEvent.change(within(metricRows()[0]).getByRole('combobox',{name:'Тип'}),{target:{value:'plan'}})
    fireEvent.change(within(metricRows()[0]).getByRole('textbox',{name:'Комментарий'}),{target:{value:'Plan note'}})
    fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}));fillMetric(metricRows()[1])
    await chooseMonth(metricRows()[1],'Октябрь 2026')
    fireEvent.change(within(metricRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'fact'}})
    const keys=[qk.companyMetrics('org1','c1'),qk.companyUnitEconomics('org1','c1'),qk.companyPnl('org1','c1'),qk.companyCashflow('org1','c1'),qk.dashboard('org1'),qk.dashboardPerformance('org1',6)]
    keys.forEach(key=>client.setQueryData(key,{}));client.setQueryData(qk.dashboard('foreign'),{})
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
    await dialog().findByRole('heading',{name:'Когорта'})
    expect(http.put).toHaveBeenCalledOnce()
    expect(http.put.mock.calls[0][0]).toBe('/companies/c1/metrics/bulk')
    const body=http.put.mock.calls[0][1] as MetricBulkUpsert
    expect(body.items).toEqual([
      {period:'2026-10-01',type:'fact',new_units:10,arpu:100.25,revenue:0,marketing_spend:0,retention_rate:0.85,comment:null},
      {period:'2026-11-01',type:'plan',new_units:10,arpu:100.25,revenue:0,marketing_spend:0,retention_rate:0.85,comment:'Plan note'},
    ])
    for(const key of keys)expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    expect(client.getQueryState(qk.dashboard('foreign'))?.isInvalidated).toBe(false)
    expect(body.items.every(row=>!('active_units' in row)&&!('cac' in row)&&!('ltv' in row)&&!('churn' in row))).toBe(true)
  })
  it('does not advance before success; repeated Next and Enter submit share one pending request',async()=>{
    let finish!:(value:unknown)=>void
    http.put.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    setup();fillMetric()
    const next=dialog().getByRole('button',{name:'Далее'})
    fireEvent.click(next);fireEvent.click(next);fireEvent.submit(next.closest('form')!)
    await waitFor(()=>expect(http.put).toHaveBeenCalledOnce())
    expect(dialog().getByRole('heading',{name:'Метрика'})).toBeInTheDocument()
    expect(next).toBeDisabled()
    expect(dialog().getAllByRole('button',{name:'Отмена'})[0]).toBeDisabled()
    await act(async()=>finish({data:[]}))
    expect(await dialog().findByRole('heading',{name:'Когорта'})).toBeInTheDocument()
  })
  it.each(['plan','fact'] as const)('Metric %s upsert preserves the existing counterpart in the same month',async(type)=>{
    const records={plan:{revenue:600000},fact:{revenue:700000}}
    http.put.mockImplementation((path:string,data:MetricBulkUpsert)=>{
      expect(path).toBe('/companies/c1/metrics/bulk')
      data.items.forEach(item=>{expect(item.period).toBe('2026-10-01');records[item.type]={revenue:item.revenue}})
      return Promise.resolve({data:[]})
    })
    setup();fillMetric()
    fireEvent.change(within(metricRows()[0]).getByRole('combobox',{name:'Тип'}),{target:{value:type}})
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
    await dialog().findByRole('heading',{name:'Когорта'})
    expect(records[type].revenue).toBe(0)
    expect(records[type==='plan'?'fact':'plan'].revenue).toBe(type==='plan'?700000:600000)
  })
  it('Metric API failure retains draft on the same step and retry succeeds',async()=>{
    http.put.mockRejectedValueOnce({response:{data:{detail:'Invalid source'}}}).mockResolvedValue({data:[]})
    setup();fillMetric()
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
    expect(await dialog().findByRole('alert')).toHaveTextContent('Invalid source')
    expect(within(metricRows()[0]).getByRole('spinbutton',{name:'Удержание (%)'})).toHaveValue(85)
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
    await dialog().findByRole('heading',{name:'Когорта'})
    expect(http.put).toHaveBeenCalledTimes(2)
  })
  it('Back shows completed Metric read-only and Next does not save it again',async()=>{
    setup();await toCohort()
    fireEvent.click(dialog().getByRole('button',{name:'Назад'}))
    expect(within(metricRows()[0]).getByRole('spinbutton',{name:'Выручка'})).toBeDisabled()
    expect(dialog().getByRole('list',{name:'Шаги ввода данных'}).querySelector('[aria-current="step"]')).toHaveTextContent('Сохранено')
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
    expect(dialog().getByRole('heading',{name:'Когорта'})).toBeInTheDocument()
    expect(http.put).toHaveBeenCalledOnce()
  })
})

describe('Cohort and Budget steps',()=>{
  it.each(['M1 (%)','Маркетинг (₽)'])('blocks browser badInput in optional %s instead of saving it as missing',async(label)=>{
    setup();await toCohort()
    fireEvent.change(dialog().getByRole('spinbutton',{name:'Размер когорты'}),{target:{value:'10'}})
    const input=dialog().getByRole('spinbutton',{name:label}) as HTMLInputElement
    // JSDOM does not model incomplete browser number drafts such as "e".
    const validity=vi.spyOn(input,'validity','get').mockReturnValue({...input.validity,badInput:true})
    fireEvent.input(input,{target:{value:''}})
    const next=dialog().getByRole('button',{name:'Далее'})
    expect(input).toHaveAttribute('aria-invalid','true')
    expect(input).toHaveAccessibleDescription('Введите число не меньше 0.')
    expect(next).toBeDisabled()
    fireEvent.submit(next.closest('form')!)
    expect(http.put).toHaveBeenCalledOnce() // Only the previous Metric step.
    validity.mockRestore()
    fireEvent.input(input,{target:{value:''}})
    expect(next).toBeEnabled()
    fireEvent.click(next)
    await dialog().findByRole('heading',{name:'Бюджет'})
    expect(http.put.mock.calls[1][1]).toMatchObject({retention_m1:null})
    expect(http.put.mock.calls[1][1]).not.toHaveProperty('marketing_spend')
  })
  it('validates Cohort size, optional ranges and preserves null/zero percentage semantics',async()=>{
    const {client}=setup();await toCohort()
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    const size=dialog().getByRole('spinbutton',{name:'Размер когорты'})
    for(const value of ['0','1.5']){fireEvent.change(size,{target:{value}});expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()}
    fireEvent.change(size,{target:{value:'10'}})
    const marketing=dialog().getByRole('spinbutton',{name:'Маркетинг (₽)'})
    fireEvent.change(marketing,{target:{value:'-1'}})
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    fireEvent.change(marketing,{target:{value:''}})
    fireEvent.change(dialog().getByRole('spinbutton',{name:'M1 (%)'}),{target:{value:'101'}})
    expect(dialog().getByRole('button',{name:'Далее'})).toBeDisabled()
    fireEvent.change(dialog().getByRole('spinbutton',{name:'M1 (%)'}),{target:{value:'85'}})
    fireEvent.change(dialog().getByRole('spinbutton',{name:'M2 (%)'}),{target:{value:'0'}})
    const key=qk.companyUnitEconomics('org1','c1');client.setQueryData(key,{})
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}));await dialog().findByRole('heading',{name:'Бюджет'})
    expect(http.put.mock.calls[1][0]).toBe('/companies/c1/cohorts')
    expect(http.put.mock.calls[1][1]).toEqual({period:'2026-10-01',type:'fact',size:10,retention_m1:0.85,retention_m2:0,retention_m3:null,retention_m4:null,retention_m5:null,retention_m6:null,retention_m7:null,retention_m8:null,retention_m9:null,retention_m10:null,retention_m11:null,retention_m12:null})
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })
  it('Cohort error keeps entered data and explicit retry advances',async()=>{
    setup();await toCohort()
    http.put.mockRejectedValueOnce(new Error('Cohort offline')).mockResolvedValue({data:[]})
    fireEvent.change(dialog().getByRole('spinbutton',{name:'Размер когорты'}),{target:{value:'10'}})
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}))
    expect(await dialog().findByRole('alert')).toHaveTextContent('Cohort offline')
    expect(dialog().getByRole('spinbutton',{name:'Размер когорты'})).toHaveValue(10)
    fireEvent.click(dialog().getByRole('button',{name:'Далее'}));await dialog().findByRole('heading',{name:'Бюджет'})
  })
  it('Budget starts one month from Metric, requires all four values and explicit type for an added month',async()=>{
    setup();await toBudget()
    expect(budgetRows()).toHaveLength(1)
    expect(within(budgetRows()[0]).getByRole('button',{name:'Период'})).toHaveTextContent('Октябрь 2026')
    expect(dialog().getByRole('button',{name:'Завершить'})).toBeDisabled()
    fillBudget();expect(dialog().getByRole('button',{name:'Завершить'})).toBeEnabled()
    fireEvent.change(within(budgetRows()[0]).getByRole('spinbutton',{name:'G&A'}),{target:{value:''}})
    expect(dialog().getByRole('button',{name:'Завершить'})).toBeDisabled()
    fillBudget();fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}))
    expect(within(budgetRows()[1]).getByRole('button',{name:'Период'})).toHaveTextContent('Ноябрь 2026')
    expect(within(budgetRows()[1]).getByRole('combobox',{name:'Тип'})).toHaveValue('')
    fireEvent.click(within(budgetRows()[1]).getByRole('button',{name:'Удалить месяц'}))
    expect(budgetRows()).toHaveLength(1)
  })
  it('keeps partial Budget success, identifies the failed month and retries only unsaved rows',async()=>{
    setup();await toBudget();fillBudget()
    fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}));fillBudget(budgetRows()[1])
    fireEvent.change(within(budgetRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'plan'}})
    let failed=false
    http.put.mockImplementation((path:string,body:BudgetUpsert)=>{
      if(path.endsWith('/budgets')&&body.period==='2026-11-01'&&!failed){failed=true;return Promise.reject({response:{data:{detail:'Budget offline'}}})}
      return Promise.resolve({data:{}})
    })
    fireEvent.click(dialog().getByRole('button',{name:'Завершить'}))
    expect(await dialog().findByRole('alert')).toHaveTextContent('Ноябрь 2026 · План не сохранён: Budget offline')
    expect(dialog().getByText(/Сохранено месяцев бюджета: 1 из 2/)).toBeInTheDocument()
    expect(within(budgetRows()[0]).getByRole('spinbutton',{name:'ФОТ'})).toBeDisabled()
    expect(within(budgetRows()[1]).getByRole('spinbutton',{name:'Разработка'})).toHaveValue(1.25)
    fireEvent.click(dialog().getByRole('button',{name:'Завершить'}))
    await dialog().findByRole('status',{name:''})
    expect(dialog().getByText('Данные сохранены')).toBeInTheDocument()
    const calls=http.put.mock.calls.filter(([path])=>path.endsWith('/budgets'))
    expect(calls.map(([,body])=>(body as BudgetUpsert).period)).toEqual(['2026-10-01','2026-11-01','2026-11-01'])
    expect(calls[0][1]).toEqual({period:'2026-10-01',type:'fact',cogs:0,marketing:0,development:1.25,fot:0,gna:0})
    expect(calls[1][1]).toMatchObject({period:'2026-11-01',type:'plan'})
    fireEvent.click(dialog().getByRole('button',{name:'Готово'}))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('rejects Budget duplicates, permits Plan/Fact of the same month, and saves their exact identities',async()=>{
    setup();await toBudget();fillBudget()
    fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}));fillBudget(budgetRows()[1])
    await chooseMonth(budgetRows()[1],'Октябрь 2026')
    fireEvent.change(within(budgetRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'fact'}})
    expect(dialog().getByRole('button',{name:'Завершить'})).toBeDisabled()
    expect(dialog().getAllByRole('alert')[0]).toHaveTextContent('Этот месяц и тип уже есть')
    fireEvent.change(within(budgetRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'plan'}})
    fireEvent.click(dialog().getByRole('button',{name:'Завершить'}));await dialog().findByText('Данные сохранены')
    expect(http.put.mock.calls.filter(([path])=>path.endsWith('/budgets')).map(([,body])=>[body.period,body.type])).toEqual([['2026-10-01','fact'],['2026-10-01','plan']])
  })
  it('guards repeated Finish and Enter during Budget pending, without optimistic completion',async()=>{
    setup();await toBudget();fillBudget()
    let finish!:(value:unknown)=>void
    http.put.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    const button=dialog().getByRole('button',{name:'Завершить'})
    fireEvent.click(button);fireEvent.submit(button.closest('form')!);fireEvent.click(button)
    await waitFor(()=>expect(http.put.mock.calls.filter(([path])=>path.endsWith('/budgets'))).toHaveLength(1))
    expect(button).toBeDisabled()
    expect(dialog().queryByText('Данные сохранены')).not.toBeInTheDocument()
    await act(async()=>finish({data:{}}))
    await dialog().findByText('Данные сохранены')
  })
  it.each(['plan','fact'] as const)('Budget %s writes exact source identity without sending the counterpart',async(type)=>{
    setup();await toBudget();fillBudget()
    fireEvent.change(within(budgetRows()[0]).getByRole('combobox',{name:'Тип'}),{target:{value:type}})
    fireEvent.click(dialog().getByRole('button',{name:'Завершить'}));await dialog().findByText('Данные сохранены')
    const calls=http.put.mock.calls.filter(([path])=>path.endsWith('/budgets'))
    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toMatchObject({period:'2026-10-01',type})
  })
})

describe('Partial progress, close and session safety',()=>{
  it('warns on local dirty Escape and allows returning to the draft',()=>{
    setup();fillMetric()
    fireEvent.keyDown(screen.getByRole('dialog'),{key:'Escape'})
    expect(screen.getByRole('dialog',{name:'Закрыть ввод без сохранения?'})).toBeInTheDocument()
    fireEvent.click(within(screen.getByRole('dialog',{name:'Закрыть ввод без сохранения?'})).getAllByRole('button',{name:'Продолжить ввод'})[0])
    expect(within(metricRows()[0]).getByRole('spinbutton',{name:'Удержание (%)'})).toHaveValue(85)
    expect(http.put).not.toHaveBeenCalled()
  })
  it('confirms persisted progress on close, keeps server writes and reopens a fresh local session',async()=>{
    setup();await toCohort()
    fireEvent.click(dialog().getAllByRole('button',{name:'Отмена'})[0])
    const confirm=screen.getByRole('dialog',{name:'Часть данных уже сохранена. Закрыть ввод?'})
    expect(confirm).toHaveTextContent('Метрика (1 мес.)')
    expect(confirm).toHaveTextContent('останутся на сервере')
    fireEvent.click(within(confirm).getByRole('button',{name:'Закрыть ввод'}))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Начало ввода данных'}))
    expect(metricRows()).toHaveLength(1)
    expect(within(metricRows()[0]).getByRole('spinbutton',{name:'Выручка'})).toHaveValue(null)
    expect(http.put).toHaveBeenCalledOnce()
  })
  it.each([{companyId:'c2'},{tenantKey:'other-org'}])('closes/resets on changed scope $companyId $tenantKey without carrying the old draft',async(props)=>{
    const view=setup();fillMetric()
    view.rerender(view.tree(props))
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(http.put).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button',{name:'Начало ввода данных'}))
    expect(within(metricRows()[0]).getByRole('spinbutton',{name:'Выручка'})).toHaveValue(null)
  })
  it('changing company during a Budget batch stops remaining calls; an in-flight write stays bound to the original company',async()=>{
    const view=setup();await toBudget();fillBudget()
    fireEvent.click(dialog().getByRole('button',{name:'Добавить месяц'}));fillBudget(budgetRows()[1])
    fireEvent.change(within(budgetRows()[1]).getByRole('combobox',{name:'Тип'}),{target:{value:'plan'}})
    let finish!:(value:unknown)=>void
    http.put.mockImplementation(()=>new Promise(resolve=>{finish=resolve}))
    fireEvent.click(dialog().getByRole('button',{name:'Завершить'}))
    await waitFor(()=>expect(http.put.mock.calls.filter(([path])=>path.endsWith('/budgets'))).toHaveLength(1))
    view.rerender(view.tree({companyId:'c2'}))
    await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await act(async()=>finish({data:{}}))
    expect(http.put.mock.calls.filter(([path])=>path.endsWith('/budgets')).map(([path])=>path)).toEqual(['/companies/c1/budgets'])
  })
  it('has keyboard focus and EN step/action translations',async()=>{
    await i18n.changeLanguage('en')
    setup()
    expect(screen.getByRole('heading',{name:'Metric'})).toHaveFocus()
    expect(screen.getByRole('dialog',{name:'Start data entry'})).toHaveTextContent('Each step is saved separately')
    expect(screen.getByRole('list',{name:'Data entry steps'})).toHaveTextContent('Metric')
    const user=userEvent.setup();await user.tab()
    expect(screen.getByRole('button',{name:'Period'})).toHaveFocus()
    expect(screen.getByRole('button',{name:'Next'})).toBeDisabled()
  })
})

describe('E19 Wizard Budget sources', () => {
  it('requires COGS, applies local G&A helper and sends only five stored amounts', async () => {
    setup(); await toBudget(); fillBudget()
    const row = within(budgetRows()[0])
    fireEvent.change(row.getByRole('spinbutton', { name: 'Себестоимость (COGS)' }), { target: { value: '' } })
    expect(dialog().getByRole('button', { name: 'Завершить' })).toBeDisabled()
    fireEvent.change(row.getByRole('spinbutton', { name: 'Себестоимость (COGS)' }), { target: { value: '40.5' } })
    const before = http.put.mock.calls.length
    fireEvent.click(row.getByRole('button', { name: 'Рассчитать по статьям' }))
    fireEvent.change(row.getByRole('spinbutton', { name: 'Бухгалтерия и аудит' }), { target: { value: '12.75' } })
    expect(row.getByText(/Детализация используется только/)).toBeInTheDocument()
    fireEvent.click(row.getByRole('button', { name: 'Применить сумму' }))
    expect(row.getByRole('spinbutton', { name: 'G&A' })).toHaveValue(12.75)
    expect(http.put).toHaveBeenCalledTimes(before)
    fireEvent.click(dialog().getByRole('button', { name: 'Завершить' }))
    await dialog().findByText('Данные сохранены')
    expect(http.put).toHaveBeenCalledTimes(before + 1)
    expect(http.put.mock.lastCall?.[1]).toEqual({ period: '2026-10-01', type: 'fact', cogs: 40.5, marketing: 0, development: 1.25, fot: 0, gna: 12.75 })
  })
})
