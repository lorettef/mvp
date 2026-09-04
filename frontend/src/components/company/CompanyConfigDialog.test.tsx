import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyConfigDialog } from './CompanyConfigDialog'
import type { Company, CatalogResponse } from '@/types/api'

const mocks = vi.hoisted(() => ({
  catalogGet: vi.fn(),
  companiesUpdate: vi.fn(),
}))

vi.mock('@/api/catalog', () => ({ catalogApi: { get: mocks.catalogGet } }))
vi.mock('@/api/companies', () => ({ companiesApi: { update: mocks.companiesUpdate } }))

const metric = (key: string, label: string) => ({ key, label, required: true, why: `${label} — обоснование` })

const catalog: CatalogResponse = {
  industries: [
    { slug: 'saas', label: 'SaaS' },
    { slug: 'ecommerce', label: 'E-commerce' },
  ],
  business_models: [
    { slug: 'subscription', label: 'Подписка (SaaS)', description: 'Повторяющаяся выручка' },
    { slug: 'retail', label: 'Онлайн-ритейл', description: 'Прямые продажи' },
  ],
  profiles: {
    saas: {
      subscription: {
        label: 'SaaS-подписка',
        why: 'Подписка — ядро SaaS.',
        metrics: [
          metric('new_units', 'Новые платящие клиенты'),
          metric('arpu', 'Средняя выручка на клиента'),
          metric('revenue', 'Повторяющаяся выручка (MRR/ARR)'),
          metric('marketing_spend', 'Расходы на привлечение'),
          metric('retention_rate', 'Удержание подписчиков'),
        ],
        derived: ['churn', 'ltv', 'cac'],
      },
    },
    ecommerce: {
      retail: {
        label: 'Интернет-магазин',
        why: 'Прямые продажи товаров.',
        metrics: [
          metric('new_units', 'Новые заказы'),
          metric('arpu', 'Средний чек (AOV)'),
          metric('revenue', 'Выручка от продаж'),
          metric('marketing_spend', 'Расходы на маркетинг'),
          metric('retention_rate', 'Повторные покупки'),
        ],
        derived: ['churn', 'ltv', 'cac'],
      },
    },
  },
}

const company: Company = {
  id: 'comp1',
  organizationId: 'org1',
  name: 'Acme',
  industry: 'saas',
  businessModel: 'subscription',
  geography: 'Германия',
  grossMargin: 0.75,
  selectedMetrics: ['revenue', 'arpu'],
  archivedAt: null,
  createdAt: '',
}

function renderDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CompanyConfigDialog open company={company} tenantKey="tenant1" onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  )
}

function selectOption(triggerName: string, optionName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: triggerName }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}

describe('CompanyConfigDialog', () => {
  beforeEach(() => {
    mocks.catalogGet.mockReset()
    mocks.companiesUpdate.mockReset()
    mocks.catalogGet.mockResolvedValue(catalog)
    mocks.companiesUpdate.mockResolvedValue(company)
  })

  it('shows company name, region and industry label from the catalog', async () => {
    renderDialog()

    expect(screen.getByDisplayValue('Acme')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('SaaS')).toBeInTheDocument())
    expect(screen.getByText('Подписка (SaaS)')).toBeInTheDocument()
  })

  it('merges new recommended metrics on business-model change (historical data preserved)', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByText('Подписка (SaaS)')).toBeInTheDocument())

    selectOption('Сфера деятельности', 'E-commerce')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Бизнес-модель' })).toBeInTheDocument())
    selectOption('Бизнес-модель', 'Онлайн-ритейл')

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mocks.companiesUpdate).toHaveBeenCalled())

    const payload = mocks.companiesUpdate.mock.calls[0][1]
    expect(payload.industry).toBe('ecommerce')
    expect(payload.business_model).toBe('retail')
    expect(payload.selected_metrics).toEqual(
      expect.arrayContaining(['revenue', 'arpu', 'new_units', 'marketing_spend', 'retention_rate']),
    )
  })

  it('allows unchecking a metric so it is dropped from the selection', async () => {
    renderDialog()
    await waitFor(() => expect(screen.getByText('Повторяющаяся выручка (MRR/ARR)')).toBeInTheDocument())

    const revenueCheckbox = screen.getByRole('checkbox', { name: /Повторяющаяся выручка/ })
    fireEvent.click(revenueCheckbox)

    fireEvent.click(screen.getByRole('button', { name: 'Сохранить' }))
    await waitFor(() => expect(mocks.companiesUpdate).toHaveBeenCalled())

    const payload = mocks.companiesUpdate.mock.calls[0][1]
    expect(payload.selected_metrics).not.toContain('revenue')
    expect(payload.selected_metrics).toContain('arpu')
  })
})
