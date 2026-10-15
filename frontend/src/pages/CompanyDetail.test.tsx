import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyDetail } from './CompanyDetail'
import { qk } from '@/lib/queryKeys'
import type { Metric, MetricBulkUpsert, BudgetUpsert, CohortUpsert } from '@/types/api'

// Profile charts now mount on every tab. Keep real ResponsiveContainer and
// supply observable geometry rather than disabling its resize behaviour.
beforeEach(() => {
  const original=Element.prototype.getBoundingClientRect
  vi.spyOn(Element.prototype,'getBoundingClientRect').mockImplementation(function(this:Element){
    return this.classList.contains('recharts-responsive-container')?new DOMRect(0,0,360,288):original.call(this)
  })
  vi.stubGlobal('ResizeObserver',class {
    constructor(private callback:ResizeObserverCallback){}
    observe(target:Element){this.callback([{target,contentRect:new DOMRect(0,0,360,288)} as ResizeObserverEntry],{} as ResizeObserver)}
    unobserve(){}
    disconnect(){}
  })
})
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals()})

const mocks = vi.hoisted(() => ({
  role: 'admin' as string,
  companiesApi: {
    get: vi.fn(),
    metrics: vi.fn(),
    cohorts: vi.fn(),
    budgets: vi.fn(),
    upsertMetric: vi.fn(),
    upsertMetricBulk: vi.fn(),
    deleteMetric: vi.fn(),
    deleteCohort: vi.fn(),
    deleteBudget: vi.fn(),
    update: vi.fn(),
    upsertCohort: vi.fn(),
    upsertBudget: vi.fn(),
    unitEconomics: vi.fn(),
    health: vi.fn(),
    tasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
    readiness: vi.fn(),
    recalculate: vi.fn(),
    generatePlan: vi.fn(),
    insight: vi.fn(),
  },
}))

vi.mock('@/api/companies', () => ({ companiesApi: mocks.companiesApi }))

const catalogApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/catalog', () => ({ catalogApi: catalogApiMock }))

const marketApiMock = vi.hoisted(() => ({
  analyze: vi.fn(),
}))

vi.mock('@/api/market', () => ({ marketApi: marketApiMock }))

const hiringApiMock = vi.hoisted(() => ({
  plan: vi.fn(),
  settings: vi.fn(),
  upsertSettings: vi.fn(),
}))

vi.mock('@/api/hiring', () => ({ hiringApi: hiringApiMock }))

const pnlApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/pnl', () => ({ pnlApi: pnlApiMock }))

const cashflowApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/cashflow', () => ({ cashflowApi: cashflowApiMock }))

const creditApiMock = vi.hoisted(() => ({
  forecast: vi.fn(),
}))

vi.mock('@/api/credit', () => ({ creditApi: creditApiMock }))

const valuationApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/valuation', () => ({ valuationApi: valuationApiMock }))

const sensitivityApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/api/sensitivity', () => ({ sensitivityApi: sensitivityApiMock }))

vi.mock('@/store/authStore', () => {
  const buildState = () => ({
    user: {
      id: 'u1',
      email: 'a@b.c',
      fullName: 'Admin',
      companyName: 'C',
      role: mocks.role,
      organizationId: 'org1',
      companyId: 'comp1',
      subscriptionPlan: 'pro',
      dailyLimit: 10,
      usedToday: 0,
    },
  })
  // Мок должен поддерживать и hook-вызов, и getState() для getTenantKey().
  const useAuthStore = Object.assign(buildState, { getState: buildState })
  return { useAuthStore }
})

const company = {
  id: 'comp1',
  organizationId: 'org1',
  name: 'Test Startup',
  industry: 'saas',
  businessModel: 'subscription',
  geography: 'RU',
  grossMargin: 0.75,
  selectedMetrics: ['new_units', 'arpu', 'revenue', 'marketing_spend', 'retention_rate'],
  archivedAt: null,
  createdAt: '',
}

const catalogData = {
  industries: [{ slug: 'saas', label: 'SaaS' }],
  business_models: [{ slug: 'subscription', label: 'Подписка (SaaS)', description: '' }],
  profiles: {
    saas: {
      subscription: {
        label: 'SaaS-подписка',
        why: '',
        metrics: [
          { key: 'new_units', label: 'Новые платящие клиенты', required: true, why: '' },
          { key: 'arpu', label: 'Средняя выручка на клиента', required: true, why: '' },
          { key: 'revenue', label: 'Выручка (Revenue)', required: true, why: '' },
          { key: 'marketing_spend', label: 'Расходы на привлечение', required: true, why: '' },
          { key: 'retention_rate', label: 'Удержание подписчиков', required: true, why: '' },
        ],
        derived: ['churn', 'ltv', 'cac'],
      },
    },
  },
}

const metric = {
  id: 'm1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  newUnits: 45,
  arpu: 950,
  revenue: 100000,
  marketingSpend: 14400,
  retentionRate: 0.95,
  churn: 0.05,
  ltv: 19000,
  cac: 320,
  activeUnits: 180,
  comment: null,
  createdAt: '',
  updatedAt: '',
}

const cohort = {
  id: 'c1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  size: 100,
  retentionM1: 0.8,
  retentionM2: 0.72,
  retentionM3: 0.6,
  retentionM4: 0.55,
  retentionM5: 0.52,
  retentionM6: 0.5,
  retentionM7: 0.48,
  retentionM8: 0.46,
  retentionM9: 0.44,
  retentionM10: 0.42,
  retentionM11: 0.41,
  retentionM12: 0.4,
  marketingSpend: 50000,
  createdAt: '',
  updatedAt: '',
}

const budget = {
  id: 'b1',
  companyId: 'comp1',
  period: '2025-03-01',
  type: 'plan',
  marketing: 100000,
  development: 200000,
  fot: 300000,
  gna: 50000,
  createdAt: '',
  updatedAt: '',
}

const unitEconomicsData = {
  companyId: 'comp1',
  sourceMetric: { id: 'unit-source', period: '2026-02-01', type: 'fact', newUnits: 10,
    arpu: 150, revenue: 120000, marketingSpend: 10000, retentionRate: 0.97, comment: 'Keep comment' },
  revenue: 120000,
  cac: 1000,
  ltv: 5000,
  churn: 0.03,
  ltvCac: 5.0,
  runwayMonths: 15.0,
  paybackPeriod: 4.2,
  romi: 3.0,
  cash: 300000,
  monthlyBurn: 20000,
  magicNumber: 3.5,
  revenueGrowth: 20000,
  marketingSpend: 4000,
  retention: { m1: 0.8, m3: 0.6, m6: 0.5, m12: 0.4 },
  alerts: ['✅ LTV/CAC = 5.00 — отличный показатель.'],
}

const taskData = {
  id: 't1',
  companyId: 'comp1',
  title: 'Подготовить метрики',
  description: null,
  stage: 'metrics',
  status: 'pending',
  effectiveStatus: 'pending',
  dueDate: null,
  createdAt: '',
  updatedAt: '',
}

const readinessData = {
  companyId: 'comp1',
  readiness: 0,
  totalTasks: 1,
  doneTasks: 0,
  stages: [
    { stage: 'metrics', label: 'Подготовка метрик', total: 1, done: 0, percent: 0 },
  ],
  risks: ['Подготовка метрик'],
  summary: 'Готовность 0%. Основные риски: не завершены этапы Подготовка метрик.',
}

const marketData = {
  industry: 'saas',
  industryLabel: 'SaaS',
  geography: 'RU',
  geographyLabel: 'Россия',
  horizon: 3,
  macro: { gdpGrowth: 3.5, inflation: 8.5, keyRate: 21.0 },
  marketSize: 300,
  marketSizeProjected: 456.3,
  marketGrowth: 15,
  trends: ['Сдвиг к AI-функциям'],
  impact: { mrrFactor: 1.01, cacFactor: 1.09, churnFactor: 1.04 },
  summary: 'SaaS в географии «Россия».',
}

const hiringPlanData = {
  companyId: 'comp1',
  forecastStart: '2026-09-01',
  settings: {
    companyId: 'comp1',
    ndflRate: 0.13,
    insuranceRate: 0.3,
    injuryRate: 0.002,
    totalRate: 0.432,
    employerRate: 0.302,
  },
  team: [{ roleKey: 'backend', headcount: 1, salary: 150000 }],
  months: [
    {
      period: '2026-09-01',
      roles: [
        {
          roleKey: 'backend',
          label: 'Backend',
          group: 'engineering',
          requiredHeadcount: 2,
          recommendedHires: 1,
          approvedHires: 0,
          salary: 150000,
          employerCost: 45300,
        },
      ],
      totalRequired: 2,
      totalApproved: 0,
      payroll: 300000,
    },
  ],
  finalHeadcount: 2,
  summary: 'Целевой штат через 12 мес.',
}

const pnlFact = {
  metricSource: { ...unitEconomicsData.sourceMetric, id: 'pnl-metric', revenue: 100000 },
  budgetSource: { id: 'pnl-budget', period: '2026-02-01', type: 'fact', fot: 30000, marketing: 10000, development: 20000, gna: 5000 },
  revenue: 100000, fot: 30000, socialPayments: 9060, marketing: 10000, development: 20000, gna: 5000,
  totalOpex: 74060, ebitda: 25940, financialExpenses: 0, netProfit: 25940, ebitdaMargin: 0.2594, netMargin: 0.2594,
}
const pnlData = {
  periods: [{ period: '2026-02-01', plan: null, fact: pnlFact }],
  companyId: 'comp1',
  period: '2026-02-01',
  mrr: 100000,
  oneTimeRevenue: 0,
  revenue: 100000,
  fot: 30000,
  socialPayments: 12960,
  marketing: 10000,
  development: 20000,
  gna: 5000,
  totalOpex: 77960,
  ebitda: 22040,
  financialExpenses: 15000,
  netProfit: 7040,
  ebitdaMargin: 0.2204,
  netMargin: 0.0704,
  summary: 'EBITDA = 22 040 ₽.',
  months: [],
}

const cashflowData = {
  companyId: 'comp1',
  period: '2026-02-01',
  netProfit: 7040,
  amortization: 0,
  operatingCf: 7040,
  capex: 0,
  investingCf: 0,
  investments: 200000,
  credits: 100000,
  financingCf: 300000,
  totalCf: 307040,
  openingBalance: 0,
  closingBalance: 307040,
  summary: 'Операционный CF = 7 040 ₽.',
  months: [],
}

const creditData = {
  companyId: 'comp1',
  geography: 'RU',
  keyRate: 21,
  creditRate: 26,
  openingCash: 100000,
  baseRevenue: 50000,
  baseOpex: 77960,
  months: [],
  gaps: [],
  totalCreditNeeded: 0,
  summary: 'Кассовых разрывов не прогнозируется.',
}

const valuationData = {
  companyId: 'comp1',
  geography: 'RU',
  keyRate: 21,
  discountRate: 31,
  growthRate: 8.5,
  fcf: 7040,
  terminalValue: 33948.44,
  debt: 100000,
  cash: 200000,
  netDebt: -100000,
  equityValue: 133948.44,
  revenueAnnual: 1200000,
  psRatio: 0.11,
  headcount: 1,
  valuePerEmployee: 133948.44,
  summary: 'Оценка (Equity Value) = 133 948 ₽.',
}

const sensitivityData = {
  companyId: 'comp1',
  geography: 'RU',
  keyRate: 21,
  discountRate: 31,
  base: {
    equityValue: 1000000,
    terminalValue: 500000,
    fcf: 107040,
    growthRate: 8.5,
    mrr: 200000,
    cac: 1000,
    ltv: 5000,
    churn: 0.035,
    ltvCac: 5.0,
  },
  conservative: {
    equityValue: 800000,
    terminalValue: 400000,
    fcf: 86040,
    growthRate: 7.8,
    mrr: 180000,
    cac: 1100,
    ltv: 4750,
    churn: 0.0385,
    ltvCac: 4.32,
  },
  equityDelta: -200000,
  equityDeltaPct: -20.0,
  stresses: [
    { name: 'revenue', equityValue: 800000, equityDelta: -200000, equityDeltaPct: -20.0 },
    { name: 'combined', equityValue: 800000, equityDelta: -200000, equityDeltaPct: -20.0 },
  ],
  summary: 'Консервативный сценарий снижает оценку.',
}

const planGenerateData = {
  companyId: 'comp1',
  provider: 'demo',
  summary: 'Демо-план: рост выручки 5% в месяц.',
  metrics: [
    {
      period: '2026-03-01',
      newUnits: 50,
      arpu: 950,
      revenue: 126000,
      marketingSpend: 15750,
      retentionRate: 0.96,
    },
    {
      period: '2026-04-01',
      newUnits: 52,
      arpu: 960,
      revenue: 132300,
      marketingSpend: 16200,
      retentionRate: 0.96,
    },
  ],
}

function renderCompanyDetail(tab?: string, providedClient?: QueryClient) {
  const queryClient = providedClient ?? new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const entry = tab ? `/companies/comp1?tab=${tab}` : '/companies/comp1'
  vi.spyOn(queryClient,'invalidateQueries')
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <Link to="/companies/comp1?tab=pnl">Open P&amp;L</Link>
        <Link to="/companies/comp2">Open another company</Link>
        <Routes>
          <Route path="/companies/:companyId" element={<CompanyDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Active overview queries refetch immediately and clear isInvalidated. Verify
// the actual tenant-prefixed invalidation call, in addition to server displays.
function expectInvalidated(client:QueryClient,key:readonly unknown[]) {
  expect(vi.mocked(client.invalidateQueries).mock.calls.some(([filters])=>filters?.queryKey?.every((part,index)=>
    JSON.stringify(part)===JSON.stringify(key[index])))).toBe(true)
}

describe('CompanyDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = 'admin'
    mocks.companiesApi.get.mockResolvedValue(company)
    mocks.companiesApi.metrics.mockResolvedValue([metric])
    mocks.companiesApi.cohorts.mockResolvedValue([cohort])
    mocks.companiesApi.budgets.mockResolvedValue([budget])
    mocks.companiesApi.unitEconomics.mockResolvedValue(unitEconomicsData)
    mocks.companiesApi.health.mockResolvedValue({companyId:'comp1',status:'healthy',signals:[],summary:'В норме'})
    mocks.companiesApi.tasks.mockResolvedValue([taskData])
    mocks.companiesApi.readiness.mockResolvedValue(readinessData)
    marketApiMock.analyze.mockResolvedValue(marketData)
    hiringApiMock.plan.mockResolvedValue(hiringPlanData)
    hiringApiMock.upsertSettings.mockResolvedValue(hiringPlanData.settings)
    pnlApiMock.get.mockResolvedValue(pnlData)
    cashflowApiMock.get.mockResolvedValue(cashflowData)
    creditApiMock.forecast.mockResolvedValue(creditData)
    valuationApiMock.get.mockResolvedValue(valuationData)
    sensitivityApiMock.get.mockResolvedValue(sensitivityData)
    mocks.companiesApi.generatePlan.mockResolvedValue(planGenerateData)
    mocks.companiesApi.insight.mockResolvedValue({ companyId:'comp1',scenario:'overview',provider:'demo',text:'Проблема\nНедостаточно данных.\n\nПричина\nПо доступным данным достоверно определить причину нельзя.\n\nДействие\nСверьте исходные документы.\nДедлайн: в течение 7 дней' })
    mocks.companiesApi.deleteMetric.mockResolvedValue(undefined)
    mocks.companiesApi.deleteCohort.mockResolvedValue(undefined)
    mocks.companiesApi.deleteBudget.mockResolvedValue(undefined)
    catalogApiMock.get.mockResolvedValue(catalogData)
  })

  it.each(['admin','company'])('places one user-triggered overview AI after active content for %s, retaining it across tabs', async role => {
    mocks.role = role
    renderCompanyDetail()
    const region = await screen.findByRole('region',{name:'ИИ-анализ компании'})
    const metrics = screen.getByRole('tabpanel')
    expect(metrics.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mocks.companiesApi.insight).not.toHaveBeenCalled()
    fireEvent.click(within(region).getByRole('button',{name:'Сформировать анализ'}))
    await within(region).findByText(/Сверьте исходные документы/)
    expect(mocks.companiesApi.insight).toHaveBeenCalledWith('comp1','overview')
    fireEvent.click(screen.getByRole('link',{name:'Open P&L'}))
    await screen.findByRole('table',{name:'P&L: месяцы, план и факт'})
    expect(screen.getAllByRole('region',{name:'ИИ-анализ компании'})).toHaveLength(1)
    expect(within(region).getByText(/Сверьте исходные документы/)).toBeInTheDocument()
    expect(mocks.companiesApi.insight).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('tabpanel').compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('does not offer or request company AI for observer', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('pnl')
    await screen.findByRole('table',{name:'P&L: месяцы, план и факт'})
    expect(screen.queryByRole('region',{name:'ИИ-анализ компании'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Сформировать анализ'})).not.toBeInTheDocument()
    expect(mocks.companiesApi.insight).not.toHaveBeenCalled()
  })

  it('remounts company AI identity when the profile company changes', async () => {
    renderCompanyDetail()
    const region = await screen.findByRole('region',{name:'ИИ-анализ компании'})
    fireEvent.click(within(region).getByRole('button',{name:'Сформировать анализ'}))
    await within(region).findByText(/Сверьте исходные документы/)
    mocks.companiesApi.get.mockResolvedValueOnce({...company,id:'comp2',name:'Other startup'})
    fireEvent.click(screen.getByRole('link',{name:'Open another company'}))
    await screen.findByText('Other startup')
    expect(screen.queryByText(/Сверьте исходные документы/)).not.toBeInTheDocument()
    expect(mocks.companiesApi.insight).toHaveBeenCalledTimes(1)
  })

  it.each(['admin', 'company'])('lets %s edit the server-selected metric and invalidates only the current tenant', async (role) => {
    mocks.role = role
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const metricsKey = qk.companyMetrics('org1', 'comp1')
    const dashboardKey = qk.dashboard('org1', { industries: ['saas'] })
    const otherCompanyKey = qk.companyMetrics('other-org', 'comp1')
    const otherDashboardKey = qk.dashboard('other-org')
    for (const key of [metricsKey, dashboardKey, otherCompanyKey, otherDashboardKey]) queryClient.setQueryData(key, [])
    const updated = { ...unitEconomicsData, cac: 250, ltvCac: 20 }
    mocks.companiesApi.unitEconomics.mockResolvedValueOnce(unitEconomicsData).mockResolvedValue(updated)
    mocks.companiesApi.upsertMetric.mockResolvedValue({ ...metric, id: 'unit-source' })
    renderCompanyDetail('unit', queryClient)
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать исходные данные' }))
    const dialog = screen.getByRole('dialog', { name: 'Редактировать исходные данные' })
    expect(within(dialog).getByRole('spinbutton', { name: 'Новые платящие клиенты' })).toHaveValue(10)
    expect(within(dialog).getByRole('spinbutton', { name: 'Расходы на привлечение' })).toHaveValue(10000)
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Удержание подписчиков (%)' }), { target: { value: '82' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledWith('comp1', {
      period: '2026-02-01', type: 'fact', new_units: 10, arpu: 150, revenue: 120000,
      marketing_spend: 10000, retention_rate: 0.82, comment: 'Keep comment',
    })
    expect(await screen.findByText('20.00')).toBeInTheDocument()
    expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(2)
    expectInvalidated(queryClient, metricsKey)
    expectInvalidated(queryClient, dashboardKey)
    expect(queryClient.getQueryState(otherCompanyKey)?.isInvalidated).toBe(false)
    expect(queryClient.getQueryState(otherDashboardKey)?.isInvalidated).toBe(false)
  })

  it.each(['admin','company'])('exposes the one-month wizard to %s without waiting for metrics/catalog data',async(role)=>{
    mocks.role=role
    mocks.companiesApi.metrics.mockImplementation(()=>new Promise(()=>{}))
    catalogApiMock.get.mockImplementation(()=>new Promise(()=>{}))
    renderCompanyDetail('metrics')
    fireEvent.click(await screen.findByRole('button',{name:'Начало ввода данных'}))
    const wizard=within(screen.getByRole('dialog',{name:'Начало ввода данных'}))
    expect(wizard.getAllByRole('group',{name:/^Метрика — месяц/})).toHaveLength(1)
    expect(wizard.getByRole('button',{name:'Далее'})).toBeDisabled()
    fireEvent.click(wizard.getAllByRole('button',{name:'Отмена'})[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getAllByRole('region',{name:'Обзор компании'})).toHaveLength(1)
    expect(screen.getAllByRole('group',{name:'Графики компании'})).toHaveLength(1)
  })

  it('keeps the data-entry wizard unavailable to observers',async()=>{
    mocks.role='observer'
    renderCompanyDetail('metrics')
    await screen.findByText('Метрики — План vs Факт')
    expect(screen.queryByRole('button',{name:'Начало ввода данных'})).not.toBeInTheDocument()
  })

  it('wizard writes through existing company APIs, refreshes server tables and preserves previous Plan records and tenant caches',async()=>{
    const qc=new QueryClient({defaultOptions:{queries:{retry:false}}})
    const foreign=qk.dashboard('foreign')
    const portfolio=qk.dashboard('org1')
    qc.setQueryData(foreign,{});qc.setQueryData(portfolio,{})
    let createdMetric:Metric|undefined
    mocks.companiesApi.upsertMetricBulk.mockImplementationOnce(async(companyId:string,data:MetricBulkUpsert)=>{
      expect(companyId).toBe('comp1')
      const item=data.items[0]
      createdMetric={...metric,id:'wizard-metric',period:item.period,type:item.type,newUnits:item.new_units,arpu:item.arpu,revenue:200006,marketingSpend:item.marketing_spend,retentionRate:item.retention_rate,comment:item.comment??null}
      mocks.companiesApi.metrics.mockResolvedValue([metric,createdMetric])
      return [createdMetric]
    })
    mocks.companiesApi.upsertCohort.mockImplementationOnce(async(companyId:string,data:CohortUpsert)=>{expect(companyId).toBe('comp1');return {...cohort,period:data.period,type:data.type}})
    mocks.companiesApi.upsertBudget.mockReset().mockImplementationOnce(async(companyId:string,data:BudgetUpsert)=>{expect(companyId).toBe('comp1');return {...budget,...data}})
    renderCompanyDetail('metrics',qc)
    await screen.findByRole('button',{name:/^Выручка \(Revenue\) · .* · План —/})
    fireEvent.click(screen.getByRole('button',{name:'Начало ввода данных'}))
    const wizard=()=>within(screen.getByRole('dialog',{name:'Начало ввода данных'}))
    const row=wizard().getByRole('group',{name:'Метрика — месяц 1'})
    const fields=within(row).getAllByRole('spinbutton')
    for(const [index,value] of ['10','100','200005','0','85'].entries())fireEvent.change(fields[index],{target:{value}})
    fireEvent.click(wizard().getByRole('button',{name:'Далее'}))
    await wizard().findByRole('heading',{name:'Когорта'})
    fireEvent.change(wizard().getByRole('spinbutton',{name:'Размер когорты'}),{target:{value:'10'}})
    fireEvent.click(wizard().getByRole('button',{name:'Далее'}))
    await wizard().findByRole('heading',{name:'Бюджет'})
    for(const label of ['Себестоимость (COGS)','Маркетинг','Разработка','ФОТ','G&A'])fireEvent.change(wizard().getByRole('spinbutton',{name:label}),{target:{value:'0'}})
    fireEvent.click(wizard().getByRole('button',{name:'Завершить'}))
    await wizard().findByText('Данные сохранены')
    fireEvent.click(wizard().getByRole('button',{name:'Готово'}))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).toHaveBeenCalledOnce()
    expect(mocks.companiesApi.upsertCohort).toHaveBeenCalledOnce()
    expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledOnce()
    const body=mocks.companiesApi.upsertMetricBulk.mock.calls[0][1] as MetricBulkUpsert
    expect(body.items[0]).toMatchObject({type:'fact',new_units:10,arpu:100,revenue:200005,marketing_spend:0,retention_rate:0.85,comment:null})
    expect(screen.getByRole('button',{name:/^Выручка \(Revenue\) · .* · Факт —/})).toHaveTextContent('₽200 006')
    expect(screen.getByRole('button',{name:/^Выручка \(Revenue\) · .* · План —/})).toHaveTextContent('₽100 000')
    expect(qc.getQueryState(portfolio)?.isInvalidated).toBe(true)
    expect(qc.getQueryState(foreign)?.isInvalidated).toBe(false)
  })

  it.each(['plan','fact'] as const)('Metrics inline %s Revenue preserves all source fields, other scenario and tenant boundaries; P&L uses refetched data', async (type) => {
    const qc = new QueryClient({ defaultOptions:{queries:{retry:false}} })
    const keys = [qk.companyBudgets,qk.companyUnitEconomics,qk.companyPnl,qk.companyCashflow,qk.companyCredit,qk.companyValuation,qk.companySensitivity].map((fn)=>fn('org1','comp1'))
    keys.push(qk.dashboard('org1'),qk.dashboard('org1',{industries:['saas']}),qk.dashboardPerformance('org1',6))
    const foreign = qk.dashboard('foreign')
    for(const key of [...keys,foreign]) qc.setQueryData(key,[])
    const plan = { ...metric,type:'plan' as const }
    const fact = { ...metric,id:'fact-id',type:'fact' as const,revenue:120000,comment:'Fact comment' }
    const original = type === 'plan' ? plan : fact
    const updated = { ...original,revenue:200001 }
    mocks.companiesApi.metrics.mockResolvedValueOnce([plan,fact]).mockResolvedValue([type==='plan'?updated:plan,type==='fact'?updated:fact])
    mocks.companiesApi.upsertMetric.mockReset().mockResolvedValue({ ...updated,revenue:999999 })
    const s = { ...pnlFact,revenue:200001,metricSource:updated }
    pnlApiMock.get.mockResolvedValue({ ...pnlData,periods:[{period:metric.period,plan:type==='plan'?s:{...pnlFact,revenue:plan.revenue,metricSource:plan},fact:type==='fact'?s:{...pnlFact,revenue:fact.revenue,metricSource:fact}}] })
    renderCompanyDetail('metrics',qc)
    const caption=type==='plan'?'План':'Факт'
    const trigger=await screen.findByRole('button',{name:new RegExp(`^Выручка \\(Revenue\\) · .* · ${caption} —`)})
    fireEvent.doubleClick(trigger)
    const input=within(within(screen.getByRole('tabpanel')).getByRole('table')).getByRole('spinbutton')
    fireEvent.change(input,{target:{value:'200000'}})
    fireEvent.keyDown(input,{key:'Enter'})
    fireEvent.blur(input)
    await waitFor(()=>expect(within(within(screen.getByRole('tabpanel')).getByRole('table')).queryByRole('spinbutton')).not.toBeInTheDocument())
    expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledOnce()
    expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledWith('comp1',{period:original.period,type,new_units:original.newUnits,arpu:original.arpu,revenue:200000,marketing_spend:original.marketingSpend,retention_rate:original.retentionRate,comment:original.comment})
    expect(screen.getByRole('button',{name:new RegExp(`^Выручка \\(Revenue\\) · .* · ${caption} —`)})).toHaveTextContent('₽200 001')
    expect(screen.getByRole('button',{name:new RegExp(`^Выручка \\(Revenue\\) · .* · ${type==='plan'?'Факт':'План'} —`)})).toHaveTextContent(type==='plan'?'₽120 000':'₽100 000')
    for(const key of keys) expectInvalidated(qc, key)
    expect(qc.getQueryState(foreign)?.isInvalidated).toBe(false)
    fireEvent.click(screen.getByRole('link',{name:'Open P&L'}))
    const pnl=await screen.findByRole('table',{name:'P&L: месяцы, план и факт'})
    await waitFor(()=>expect(within(pnl).getByRole('button',{name:new RegExp(`^Выручка · .* · ${caption} —`)})).toHaveTextContent('₽200 001'))
  })

  it.each([['Новые платящие клиенты','new_units','0'],['Удержание подписчиков','retention_rate','85']] as const)('Metrics inline Fact %s uses the raw stored source and correct unit conversion', async (label,field,raw) => {
    const fact={...metric,type:'fact' as const}
    mocks.companiesApi.metrics.mockResolvedValue([fact])
    mocks.companiesApi.upsertMetric.mockReset().mockResolvedValue(fact)
    renderCompanyDetail('metrics')
    fireEvent.doubleClick(await screen.findByRole('button',{name:new RegExp(`^${label} · .* · Факт —`)}))
    const input=within(within(screen.getByRole('tabpanel')).getByRole('table')).getByRole('spinbutton')
    fireEvent.change(input,{target:{value:raw}})
    fireEvent.keyDown(input,{key:'Enter'})
    await waitFor(()=>expect(within(within(screen.getByRole('tabpanel')).getByRole('table')).queryByRole('spinbutton')).not.toBeInTheDocument())
    expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledWith('comp1',{period:fact.period,type:'fact',new_units:45,arpu:950,revenue:100000,marketing_spend:14400,retention_rate:0.95,comment:null,[field]:field==='retention_rate'?0.85:0})
  })

  it('Metrics required/negative/integer/retention validation never submits fake source values; missing Fact remains unavailable', async () => {
    mocks.companiesApi.upsertMetric.mockReset().mockResolvedValue(metric)
    renderCompanyDetail('metrics')
    const trigger=await screen.findByRole('button',{name:/^Выручка \(Revenue\) · .* · План —/})
    for(const value of ['', '-1']) {
      fireEvent.doubleClick(screen.getByRole('button',{name:trigger.getAttribute('aria-label')!}))
      const input=within(within(screen.getByRole('tabpanel')).getByRole('table')).getByRole('spinbutton')
      fireEvent.change(input,{target:{value}})
      fireEvent.keyDown(input,{key:'Enter'})
      expect(input).toHaveAttribute('aria-invalid','true')
      fireEvent.keyDown(input,{key:'Escape'})
    }
    expect(screen.queryByRole('button',{name:/^Выручка \(Revenue\) · .* · Факт —/})).not.toBeInTheDocument()
    const factCell=within(screen.getByRole('tabpanel')).getByRole('table').querySelectorAll('tbody tr td')[2]
    expect(factCell).toHaveTextContent('—')
    fireEvent.doubleClick(factCell)
    fireEvent.keyDown(factCell,{key:'Enter'})
    expect(within(within(screen.getByRole('tabpanel')).getByRole('table')).queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetric).not.toHaveBeenCalled()
  })

  it('Metrics observer cannot start inline edits or full editors', async () => {
    mocks.role='observer'
    renderCompanyDetail('metrics')
    await within(await screen.findByRole('tabpanel')).findByRole('table')
    const table=within(screen.getByRole('tabpanel')).getByRole('table')
    expect(within(table).queryByRole('button')).not.toBeInTheDocument()
    within(table).getAllByRole('cell').forEach((cell)=>{fireEvent.doubleClick(cell);fireEvent.keyDown(cell,{key:'Enter'})})
    expect(within(within(screen.getByRole('tabpanel')).getByRole('table')).queryByRole('spinbutton')).not.toBeInTheDocument()
  })

  it.each([['Новые платящие клиенты','1.5'],['Удержание подписчиков','101']] as const)('Metrics rejects out-of-contract Fact %s', async (label,value) => {
    mocks.companiesApi.metrics.mockResolvedValue([{...metric,type:'fact'}])
    mocks.companiesApi.upsertMetric.mockReset().mockResolvedValue(metric)
    renderCompanyDetail('metrics')
    fireEvent.doubleClick(await screen.findByRole('button',{name:new RegExp(`^${label} · .* · Факт —`)}))
    const input=within(within(screen.getByRole('tabpanel')).getByRole('table')).getByRole('spinbutton')
    fireEvent.change(input,{target:{value}})
    fireEvent.keyDown(input,{key:'Enter'})
    expect(input).toHaveAttribute('aria-invalid','true')
    expect(mocks.companiesApi.upsertMetric).not.toHaveBeenCalled()
  })

  it('locks only the pending Metric record, prevents duplicate requests and leaves the other scenario editable', async () => {
    const fact={...metric,id:'fact-source',type:'fact'}
    mocks.companiesApi.metrics.mockResolvedValue([metric,fact])
    let finish!:()=>void
    mocks.companiesApi.upsertMetric.mockReset().mockImplementation(()=>new Promise<void>((resolve)=>{finish=resolve}))
    renderCompanyDetail('metrics')
    const trigger=await screen.findByRole('button',{name:/^Выручка \(Revenue\) · .* · Факт —/})
    fireEvent.doubleClick(trigger)
    const input=within(within(screen.getByRole('tabpanel')).getByRole('table')).getByRole('spinbutton')
    fireEvent.change(input,{target:{value:'200000'}})
    fireEvent.keyDown(input,{key:'Enter'})
    fireEvent.blur(input)
    fireEvent.keyDown(input,{key:'Enter'})
    await waitFor(()=>expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledOnce())
    expect(screen.getByRole('button',{name:/^Новые платящие клиенты · .* · Факт —/})).toBeDisabled()
    expect(screen.getByRole('button',{name:/^Удержание подписчиков · .* · Факт —/})).toBeDisabled()
    expect(screen.getByRole('button',{name:/^Выручка \(Revenue\) · .* · План —/})).toBeEnabled()
    await act(async()=>finish())
    await waitFor(()=>expect(within(within(screen.getByRole('tabpanel')).getByRole('table')).queryByRole('spinbutton')).not.toBeInTheDocument())
  })

  it.each(['plan','fact'] as const)('Budget inline %s FOT preserves the complete source and refetches server-derived P&L without touching the other scenario', async (type) => {
    const qc=new QueryClient({defaultOptions:{queries:{retry:false}}})
    const other=qk.companyBudgets('foreign','comp1')
    qc.setQueryData(other,[])
    const source={...budget,period:'2026-02-01',fot:30000,marketing:10000,development:20000,gna:5000}
    const fact={...source,id:'fact-budget',type:'fact' as const,fot:31000}
    const original=type==='plan'?source:fact
    const updated={...original,fot:40001}
    mocks.companiesApi.budgets.mockResolvedValueOnce([source,fact]).mockResolvedValue([type==='plan'?updated:source,type==='fact'?updated:fact])
    mocks.companiesApi.upsertBudget.mockReset().mockResolvedValue({...updated,fot:999999})
    const beforePlan={...pnlFact,budgetSource:source,fot:30000}
    const beforeFact={...pnlFact,budgetSource:fact,fot:31000}
    const after={...(type==='plan'?beforePlan:beforeFact),budgetSource:updated,fot:40001,totalOpex:99998,ebitda:2}
    pnlApiMock.get.mockResolvedValue({...pnlData,periods:[{period:source.period,plan:type==='plan'?after:beforePlan,fact:type==='fact'?after:beforeFact}]})
    renderCompanyDetail('budget',qc)
    const table=await screen.findByRole('table',{name:'Бюджет: месяцы, план и факт'})
    const caption=type==='plan'?'План':'Факт'
    fireEvent.doubleClick(within(table).getByRole('button',{name:new RegExp(`^ФОТ · .* · ${caption} —`)}))
    const input=within(table).getByRole('spinbutton')
    fireEvent.change(input,{target:{value:'40000'}})
    fireEvent.blur(input)
    await waitFor(()=>expect(within(table).queryByRole('spinbutton')).not.toBeInTheDocument())
    expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledOnce()
    expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledWith('comp1',{period:source.period,type,marketing:10000,development:20000,fot:40000,gna:5000})
    expect(within(table).getByRole('button',{name:new RegExp(`^ФОТ · .* · ${caption} —`)})).toHaveTextContent('₽40 001')
    expect(qc.getQueryState(other)?.isInvalidated).toBe(false)
    fireEvent.click(screen.getByRole('link',{name:'Open P&L'}))
    const pnl=await screen.findByRole('table',{name:'P&L: месяцы, план и факт'})
    await waitFor(()=>expect(within(pnl).getByRole('button',{name:new RegExp(`^ФОТ · .* · ${caption} —`)})).toHaveTextContent('₽40 001'))
    expect(within(pnl).getByRole('button',{name:new RegExp(`^ФОТ · .* · ${type==='plan'?'Факт':'План'} —`)})).toHaveTextContent(type==='plan'?'₽31 000':'₽30 000')
    expect(within(within(pnl).getByRole('rowheader',{name:'Итого OPEX'}).closest('tr')!).getByText('₽99 998')).toBeInTheDocument()
    expect(within(within(pnl).getByRole('rowheader',{name:'EBITDA'}).closest('tr')!).getByText('₽2')).toBeInTheDocument()
  })

  it('deletes the selected source id and refreshes the view without keeping deleted values', async () => {
    mocks.companiesApi.unitEconomics.mockResolvedValueOnce(unitEconomicsData).mockResolvedValue({
      ...unitEconomicsData, sourceMetric: null, revenue: null, cac: null, ltv: null, churn: null, ltvCac: null,
    })
    renderCompanyDetail('unit')
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать исходные данные' }))
    fireEvent.click(screen.getByRole('button', { name: 'Удалить исходную запись' }))
    const dialog = screen.getByRole('dialog', { name: 'Удалить данные за Февраль 2026?' })
    expect(mocks.companiesApi.deleteMetric).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'unit-source')
    expect(screen.queryByRole('button', { name: 'Редактировать исходные данные' })).not.toBeInTheDocument()
    expect(screen.queryByText('5.00')).not.toBeInTheDocument()
  })

  it('does not expose source editing for an observer in the actual container', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('unit')
    await screen.findByText('Источник: Факт · Февраль 2026')
    expect(screen.queryByRole('button', { name: /редактировать исходные данные/i })).not.toBeInTheDocument()
  })

  it('keeps source editor open when the metrics API rejects save', async () => {
    mocks.companiesApi.upsertMetric.mockRejectedValue({ response: { data: { detail: 'Access denied' } } })
    renderCompanyDetail('unit')
    fireEvent.click(await screen.findByRole('button', { name: 'Редактировать исходные данные' }))
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось сохранить исходные данные: Access denied')
    expect(screen.getByRole('dialog', { name: 'Редактировать исходные данные' })).toBeInTheDocument()
  })

  it.each(['metric-save', 'metric-delete', 'budget-save', 'budget-delete'])('P&L %s uses source API and invalidates all dependents only in the current tenant', async (action) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const keys = [qk.companyMetrics, qk.companyBudgets, qk.companyUnitEconomics, qk.companyCashflow, qk.companyCredit, qk.companyValuation, qk.companySensitivity]
      .map((factory) => factory('org1', 'comp1'))
    keys.push(qk.dashboard('org1', { industries: ['saas'] }), qk.dashboardPerformance('org1'))
    const otherKeys = [qk.companyMetrics('other-org', 'comp1'), qk.dashboard('other-org')]
    for (const key of [...keys, ...otherKeys]) qc.setQueryData(key, [])
    const isMetric = action.startsWith('metric')
    const deleting = action.endsWith('delete')
    const updated = { ...pnlData, periods: [{ period: '2026-02-01', plan: null, fact: { ...pnlFact,
      revenue: isMetric ? (deleting ? null : 200000) : 100000,
      fot: isMetric ? 30000 : (deleting ? null : 40000),
      ebitda: deleting ? null : 112920,
      metricSource: isMetric && deleting ? null : pnlFact.metricSource,
      budgetSource: !isMetric && deleting ? null : pnlFact.budgetSource,
    } }] }
    pnlApiMock.get.mockResolvedValueOnce(pnlData).mockResolvedValue(updated)
    mocks.companiesApi.upsertMetric.mockResolvedValue({})
    mocks.companiesApi.upsertBudget.mockResolvedValue({})
    renderCompanyDetail('pnl', qc)
    const table = await screen.findByRole('table', { name: 'P&L: месяцы, план и факт' })
    fireEvent.keyDown(within(table).getByRole('button', { name: new RegExp(`^Действия со строкой: ${isMetric ? 'Выручка' : 'ФОТ'} · .* · Факт —`) }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Редактировать источник' }))
    let editor = screen.getByRole('dialog')
    if (deleting) {
      fireEvent.click(within(editor).getByRole('button', { name: 'Удалить исходную запись' }))
      editor = screen.getByRole('dialog')
      fireEvent.click(within(editor).getByRole('button', { name: 'Удалить' }))
    } else {
      fireEvent.change(within(editor).getByRole('spinbutton', { name: isMetric ? 'Выручка (Revenue)' : 'ФОТ' }), { target: { value: isMetric ? '200000' : '40000' } })
      fireEvent.click(within(editor).getByRole('button', { name: 'Сохранить' }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    if (deleting) expect(isMetric ? mocks.companiesApi.deleteMetric : mocks.companiesApi.deleteBudget).toHaveBeenCalledWith('comp1', isMetric ? 'pnl-metric' : 'pnl-budget')
    else if (isMetric) expect(mocks.companiesApi.upsertMetric).toHaveBeenCalledWith('comp1', { period: '2026-02-01', type: 'fact', new_units: 10, arpu: 150, revenue: 200000, marketing_spend: 10000, retention_rate: 0.97, comment: 'Keep comment' })
    else expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledWith('comp1', { period: '2026-02-01', type: 'fact', cogs: null, fot: 40000, marketing: 10000, development: 20000, gna: 5000 })
    expect(pnlApiMock.get).toHaveBeenCalledTimes(2)
    expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(2)
    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    for (const key of keys) expectInvalidated(qc, key)
    for (const key of otherKeys) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    if (!deleting) expect(within(table).getByText('₽112 920')).toBeInTheDocument()
  })

  it('P&L is read-only for observer in the actual page', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('pnl')
    await screen.findByRole('table', { name: 'P&L: месяцы, план и факт' })
    expect(screen.queryByRole('button', { name: /редактировать исходную запись/ })).not.toBeInTheDocument()
  })

  it('shows metrics tab by default', async () => {
    renderCompanyDetail()
    expect(await screen.findByText('Метрики — План vs Факт')).toBeInTheDocument()
    expect(screen.queryByText('Когортный анализ — План vs Факт')).not.toBeInTheDocument()
  })

  it('has no force-recalculation action on the company page', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(screen.queryByRole('button', { name: /Принудительн/ })).not.toBeInTheDocument()
    expect(mocks.companiesApi.recalculate).not.toHaveBeenCalled()
  })

  it.each(['bulk-save', 'delete', 'generate-plan'])('Metrics %s invalidates all financial consumers and only the current tenant', async (action) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const keys = [qk.companyUnitEconomics, qk.companyPnl, qk.companyCashflow, qk.companyCredit, qk.companyValuation, qk.companySensitivity]
      .map((factory) => factory('org1', 'comp1'))
    keys.push(qk.dashboard('org1'), qk.dashboardPerformance('org1'))
    const other = qk.companyPnl('other-org', 'comp1')
    for (const key of [...keys, other]) qc.setQueryData(key, [])
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([metric])
    renderCompanyDetail('metrics', qc)
    await screen.findByText('Метрики — План vs Факт')
    if (action === 'delete') {
      fireEvent.keyDown(await screen.findByRole('button', { name: /^Действия со строкой:/ }), { key: 'Enter' })
      fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))
      fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
      await waitFor(() => expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'm1'))
    } else if (action === 'generate-plan') {
      fireEvent.click(screen.getByRole('button', { name: 'Сгенерировать план AI' }))
      await waitFor(() => expect(mocks.companiesApi.generatePlan).toHaveBeenCalledWith('comp1'))
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Добавить метрику' }))
      for (const index of [1, 2, 3]) for (const [name, value] of [['Выручка', '100000'], ['Новые юниты', '10'], ['ARPU', '100'], ['Retention %', '90']]) {
        fireEvent.change(screen.getByLabelText(`${name} ${index}`), { target: { value } })
      }
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))
      await waitFor(() => expect(mocks.companiesApi.upsertMetricBulk).toHaveBeenCalled())
    }
    await waitFor(() => { for (const key of keys) expectInvalidated(qc, key) })
    expect(qc.getQueryState(other)?.isInvalidated).toBe(false)
  })

  it('relabels metric columns by company industry and business model', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')

    expect(await screen.findByText('Выручка (Revenue) · План')).toBeInTheDocument()
    expect(screen.getByText('Выручка (Revenue) · Факт')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Добавить метрику' }))
    expect(await screen.findByText('Средняя выручка на клиента')).toBeInTheDocument()
    expect(screen.getByText('Расходы на привлечение')).toBeInTheDocument()
    expect(screen.getAllByText('Новые платящие клиенты').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Удержание подписчиков').length).toBeGreaterThan(0)
  })

  it('shares one request per overview source, while unrelated module queries stay deferred', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')

    await waitFor(() => expect(mocks.companiesApi.get).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(1))

    expect(mocks.companiesApi.cohorts).toHaveBeenCalledTimes(1)
    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    expect(mocks.companiesApi.unitEconomics).toHaveBeenCalledTimes(1)
    expect(mocks.companiesApi.tasks).not.toHaveBeenCalled()
    expect(mocks.companiesApi.readiness).not.toHaveBeenCalled()
    expect(hiringApiMock.plan).not.toHaveBeenCalled()
    expect(pnlApiMock.get).toHaveBeenCalledTimes(1)
    expect(cashflowApiMock.get).toHaveBeenCalledTimes(1)
    expect(creditApiMock.forecast).not.toHaveBeenCalled()
    expect(valuationApiMock.get).not.toHaveBeenCalled()
    expect(sensitivityApiMock.get).not.toHaveBeenCalled()
    expect(marketApiMock.analyze).not.toHaveBeenCalled()
    expect(mocks.companiesApi.health).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('link',{name:'Open P&L'}))
    await screen.findByRole('table',{name:'P&L: месяцы, план и факт'})
    expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(1)
    expect(pnlApiMock.get).toHaveBeenCalledTimes(1)
  })

  it('forwards React Query AbortSignal to the api functions', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')

    await waitFor(() => expect(mocks.companiesApi.get).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mocks.companiesApi.metrics).toHaveBeenCalledTimes(1))

    const getCall = mocks.companiesApi.get.mock.calls[0]
    expect(getCall[0]).toBe('comp1')
    expect(getCall[1].signal).toBeInstanceOf(AbortSignal)

    const metricsCall = mocks.companiesApi.metrics.mock.calls[0]
    expect(metricsCall[0]).toBe('comp1')
    expect(metricsCall[2].signal).toBeInstanceOf(AbortSignal)
  })

  it('keeps Budget source-entry deferred while loading shared overview sources', async () => {
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(mocks.companiesApi.cohorts).toHaveBeenCalledTimes(1)
    expect(mocks.companiesApi.budgets).not.toHaveBeenCalled()
    expect(mocks.companiesApi.unitEconomics).toHaveBeenCalledTimes(1)
  })

  it('renders cohorts content for ?tab=cohorts', async () => {
    renderCompanyDetail('cohorts')
    expect(await screen.findByText('Когортный анализ — матрица удержания M1–M12')).toBeInTheDocument()
  })

  it('renders budget content for ?tab=budget', async () => {
    renderCompanyDetail('budget')
    expect(await screen.findByText('Бюджет — План vs Факт')).toBeInTheDocument()
  })

  it.each(['create', 'update', 'delete'])('Budget %s refreshes server values and the paired P&L with tenant-scoped invalidation', async (action) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const dependentKeys = [qk.companyMetrics, qk.companyUnitEconomics, qk.companyCashflow, qk.companyCredit, qk.companyValuation, qk.companySensitivity]
      .map((factory) => factory('org1', 'comp1'))
    dependentKeys.push(qk.dashboard('org1'), qk.dashboardPerformance('org1'))
    const otherKeys = [qk.companyBudgets('other-org', 'comp1'), qk.dashboard('other-org')]
    for (const key of [...dependentKeys, ...otherKeys]) qc.setQueryData(key, [])
    const source = { ...budget, period: '2026-02-01', fot: 30000, marketing: 10000, development: 20000, gna: 5000 }
    const factBudget = { ...source, id: 'fact-budget', type: 'fact' }
    const planBefore = { ...pnlFact, budgetSource: source, fot: 30000 }
    qc.setQueryData(qk.companyPnl('org1', 'comp1'), { ...pnlData, periods: [{ period: source.period, plan: planBefore, fact: pnlFact }] })
    const after = action === 'delete' ? null : { ...source, fot: 40000 }
    const planAfter = { ...planBefore, budgetSource: after, fot: after?.fot ?? null, ebitda: action === 'delete' ? null : 112920 }
    pnlApiMock.get.mockResolvedValue({ ...pnlData, periods: [{ period: source.period, plan: planAfter, fact: pnlFact }] })
    mocks.companiesApi.budgets.mockResolvedValueOnce(action === 'create' ? [factBudget] : [source, factBudget])
      .mockResolvedValue(after ? [after, factBudget] : [factBudget])
    mocks.companiesApi.upsertBudget.mockResolvedValue(after)
    renderCompanyDetail('budget', qc)
    const table = await screen.findByRole('table', { name: 'Бюджет: месяцы, план и факт' })
    if (action === 'create') fireEvent.doubleClick(within(table).getByRole('button', { name: /^ФОТ · .* · План —/ }))
    else {
      fireEvent.keyDown(within(table).getByRole('button', { name: /^Действия со строкой: ФОТ · .* · План —/ }), { key: 'Enter' })
      fireEvent.click(screen.getByRole('menuitem', { name: 'Редактировать запись' }))
    }
    if (action === 'delete') {
      fireEvent.click(screen.getByRole('button', { name: 'Удалить исходную запись' }))
      fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    } else {
      for (const [name, value] of [['Себестоимость (COGS)', '0'], ['Маркетинг', '10000'], ['Разработка', '20000'], ['ФОТ', '40000'], ['G&A', '5000']]) {
        fireEvent.change(screen.getByRole('spinbutton', { name }), { target: { value } })
      }
      fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    if (action === 'delete') expect(mocks.companiesApi.deleteBudget).toHaveBeenCalledWith('comp1', 'b1')
    else expect(mocks.companiesApi.upsertBudget).toHaveBeenCalledWith('comp1', { period: source.period, type: 'plan', cogs: 0, fot: 40000, marketing: 10000, development: 20000, gna: 5000 })
    expect(mocks.companiesApi.budgets).toHaveBeenCalledTimes(2)
    expect(within(table).getByRole('button', { name: /^ФОТ · .* · План —/ })).toHaveTextContent(action === 'delete' ? '—' : '₽40 000')
    for (const key of dependentKeys) expectInvalidated(qc, key)
    for (const key of otherKeys) expect(qc.getQueryState(key)?.isInvalidated).toBe(false)
    expectInvalidated(qc,qk.companyPnl('org1','comp1'))
    fireEvent.click(screen.getByRole('link', { name: 'Open P&L' }))
    const pnl = await screen.findByRole('table', { name: 'P&L: месяцы, план и факт' })
    await waitFor(() => expect(within(pnl).getByRole('button', { name: /^ФОТ · .* · План —/ })).toHaveTextContent(action === 'delete' ? '—' : '₽40 000'))
    expect(within(pnl).getByRole('button', { name: /^ФОТ · .* · Факт —/ })).toHaveTextContent('₽30 000')
    expect(pnlApiMock.get).toHaveBeenCalledTimes(2)
  })

  it('Budget is read-only for observer in the actual company page', async () => {
    mocks.role = 'observer'
    renderCompanyDetail('budget')
    const table = await screen.findByRole('table', { name: 'Бюджет: месяцы, план и факт' })
    expect(within(table).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Добавить бюджет' })).not.toBeInTheDocument()
    fireEvent.doubleClick(within(table).getAllByRole('cell')[0])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders unit economics content for ?tab=unit', async () => {
    renderCompanyDetail('unit')
    expect(await screen.findByText('Соотношение LTV/CAC')).toBeInTheDocument()
    expect(screen.getByText('Magic Number')).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getByText('80.0%')).toBeInTheDocument()
  })

  it('renders tasks content for ?tab=tasks', async () => {
    renderCompanyDetail('tasks')
    expect(await screen.findByText('Готовность к продаже')).toBeInTheDocument()
    expect(screen.getByText('Подготовить метрики')).toBeInTheDocument()
  })

  it('renders market content for ?tab=market', async () => {
    renderCompanyDetail('market')
    expect(await screen.findByText('Внешний анализ рынка')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeInTheDocument()
  })

  it('renders hiring content for ?tab=hiring', async () => {
    renderCompanyDetail('hiring')
    expect(await screen.findByText('Прогноз найма')).toBeInTheDocument()
  })

  it('renders pnl content for ?tab=pnl', async () => {
    renderCompanyDetail('pnl')
    expect(await screen.findByText('P&L — Отчёт о прибылях и убытках')).toBeInTheDocument()
  })

  it('renders cashflow content for ?tab=cashflow', async () => {
    renderCompanyDetail('cashflow')
    expect(await screen.findByText('Данные Cash Flow ещё не рассчитаны.')).toBeInTheDocument()
  })

  it('renders credit content for ?tab=credit', async () => {
    renderCompanyDetail('credit')
    expect(await screen.findByText('Кассовый разрыв — прогнозирование')).toBeInTheDocument()
  })

  it('renders valuation content for ?tab=valuation', async () => {
    renderCompanyDetail('valuation')
    expect(await screen.findByText('Оценка бизнеса — модель Гордона')).toBeInTheDocument()
  })

  it('renders sensitivity content for ?tab=sensitivity', async () => {
    renderCompanyDetail('sensitivity')
    expect(await screen.findByText('Анализ чувствительности — консервативный сценарий')).toBeInTheDocument()
  })

  it('renders reports content for ?tab=reports', async () => {
    renderCompanyDetail('reports')
    expect(await screen.findByText('Отчёты для инвесторов')).toBeInTheDocument()
  })

  it('generates AI plan on click', async () => {
    renderCompanyDetail()
    const btn = await screen.findByRole('button', { name: /Сгенерировать план AI/ })
    fireEvent.click(btn)
    await waitFor(() => expect(mocks.companiesApi.generatePlan).toHaveBeenCalledWith('comp1'))
  })

  it('hides add buttons for observer role', async () => {
    mocks.role = 'observer'
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(screen.queryByRole('button', { name: /Добавить метрику/ })).not.toBeInTheDocument()
  })

  it('bulk-saves metrics with snake_case payload', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))
    expect(screen.getByRole('columnheader', { name: 'Пожизненная ценность клиента (LTV), ₽' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Стоимость привлечения клиента (CAC), ₽' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Отток клиентов (Churn), %' })).toBeInTheDocument()

    const now = new Date()
    const period = (offset: number) => {
      const month = new Date(now.getFullYear(), now.getMonth() - 2 + offset, 1)
      return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`
    }

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Маркетинг 1'), { target: { value: '1000' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.change(screen.getByLabelText('Выручка 2'), { target: { value: '6000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 2'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('ARPU 2'), { target: { value: '600' } })
    fireEvent.change(screen.getByLabelText('Retention % 2'), { target: { value: '85' } })

    fireEvent.change(screen.getByLabelText('Выручка 3'), { target: { value: '7000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 3'), { target: { value: '14' } })
    fireEvent.change(screen.getByLabelText('ARPU 3'), { target: { value: '700' } })
    fireEvent.change(screen.getByLabelText('Retention % 3'), { target: { value: '80' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    await waitFor(() =>
      expect(mocks.companiesApi.upsertMetricBulk).toHaveBeenCalledWith('comp1', {
        items: [
          {
            period: period(0),
            type: 'fact',
            new_units: 10,
            arpu: 500,
            revenue: 5000,
            marketing_spend: 1000,
            retention_rate: 0.9,
          },
          {
            period: period(1),
            type: 'fact',
            new_units: 12,
            arpu: 600,
            revenue: 6000,
            marketing_spend: 0,
            retention_rate: 0.85,
          },
          {
            period: period(2),
            type: 'fact',
            new_units: 14,
            arpu: 700,
            revenue: 7000,
            marketing_spend: 0,
            retention_rate: 0.8,
          },
        ],
      }),
    )
  })

  it('keeps missing preview inputs distinct from real zero in bulk metrics', async () => {
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))
    const dialog = screen.getByRole('dialog', { name: 'Добавить метрику' })
    const row = within(dialog).getAllByRole('row')[1]
    const preview = () => within(row).getAllByRole('cell').slice(-3).map(cell => cell.textContent?.trim())
    expect(preview()).toEqual(['—', '—', '—'])
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '100' } })
    expect(preview()).toEqual(['—', '—', '0.0%'])
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Маркетинг 1'), { target: { value: '0' } })
    expect(preview()).toEqual(['₽1\u00a0200', '₽0', '0.0%'])
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '' } })
    expect(preview()).toEqual(['—', '₽0', '—'])
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('blocks bulk save when a required field is empty and shows an inline message', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('ARPU 1'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    expect(
      await screen.findByText('Строка 2: поле «Новые платящие клиенты» обязательно и должно быть числом.'),
    ).toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('blocks bulk save when ARPU is empty instead of silently sending 0', async () => {
    mocks.companiesApi.upsertMetricBulk.mockResolvedValue([])
    renderCompanyDetail()
    fireEvent.click(await screen.findByRole('button', { name: /Добавить метрику/ }))

    fireEvent.change(screen.getByLabelText('Месяцев'), { target: { value: '1' } })

    fireEvent.change(screen.getByLabelText('Выручка 1'), { target: { value: '5000' } })
    fireEvent.change(screen.getByLabelText('Новые юниты 1'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Retention % 1'), { target: { value: '90' } })

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить метрики' }))

    expect(
      await screen.findByText('Строка 1: поле «Средняя выручка на клиента» обязательно и должно быть числом.'),
    ).toBeInTheDocument()
    expect(mocks.companiesApi.upsertMetricBulk).not.toHaveBeenCalled()
  })

  it('offers no manual Gross Margin input or legacy 75% default in Metrics', async () => {
    mocks.companiesApi.get.mockResolvedValue({ ...company, grossMargin: 0.75 })
    renderCompanyDetail()
    await screen.findByText('Метрики — План vs Факт')
    expect(screen.queryByRole('spinbutton', { name: /маржа|margin/i })).not.toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).queryByText('75%')).not.toBeInTheDocument()
    expect(mocks.companiesApi.update).not.toHaveBeenCalled()
  })

  it('confirms metric deletion before calling the delete API', async () => {
    renderCompanyDetail()
    fireEvent.keyDown(await screen.findByRole('button', { name: /^Действия со строкой:/ }), { key: 'Enter' })
      fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))

    expect(screen.getByRole('dialog', { name: /Удалить данные за/ })).toBeInTheDocument()
    expect(mocks.companiesApi.deleteMetric).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }))
    await waitFor(() =>
      expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'm1'),
    )
  })
  it('Metrics March Fact menu deletes only its persisted ID; March Plan and April remain after server refetch', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const plan = { ...metric, id: 'march-plan', period: '2026-03-01', type: 'plan' as const, revenue: 111 }
    const fact = { ...metric, id: 'march-fact', period: '2026-03-01', type: 'fact' as const, revenue: 222 }
    const april = { ...metric, id: 'april-fact', period: '2026-04-01', type: 'fact' as const, revenue: 333 }
    let records = [plan, fact, april]
    mocks.companiesApi.metrics.mockImplementation(async () => records)
    mocks.companiesApi.deleteMetric.mockImplementation(async (_company: string, id: string) => { records = records.filter(m => m.id !== id) })
    const foreign = qk.companyMetrics('other-org', 'comp1')
    qc.setQueryData(foreign, [{ ...metric, id: 'foreign' }])
    renderCompanyDetail('metrics', qc)
    const table = await within(await screen.findByRole('tabpanel')).findByRole('table')
    fireEvent.keyDown(within(table).getByRole('button', { name: /^Действия со строкой: Выручка.* · Март 2026 · Факт/ }), { key: 'Enter' })
    fireEvent.click(screen.getByRole('menuitem', { name: 'Удалить' }))
    expect(screen.getByRole('dialog', { name: 'Удалить данные за Март 2026?' })).toHaveTextContent('Факт')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledOnce()
    expect(mocks.companiesApi.deleteMetric).toHaveBeenCalledWith('comp1', 'march-fact')
    expect(within(table).getByRole('button', { name: /^Выручка.* · Март 2026 · План/ })).toHaveTextContent('₽111')
    expect(within(table).queryByRole('button', { name: /^Выручка.* · Март 2026 · Факт/ })).not.toBeInTheDocument()
    expect(within(table).getByRole('button', { name: /^Выручка.* · Апрель 2026 · Факт/ })).toHaveTextContent('₽333')
    for (const key of [qk.companyPnl('org1', 'comp1'), qk.companyCashflow('org1', 'comp1'), qk.dashboard('org1')]) expectInvalidated(qc, key)
    expect(qc.getQueryState(foreign)?.isInvalidated).toBe(false)
  })

})
