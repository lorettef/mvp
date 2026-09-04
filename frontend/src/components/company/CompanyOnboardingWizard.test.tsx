import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyOnboardingWizard } from './CompanyOnboardingWizard'
import type { CatalogResponse } from '@/types/api'

const mocks = vi.hoisted(() => ({
  catalogGet: vi.fn(),
  companiesCreate: vi.fn(),
}))

vi.mock('@/api/catalog', () => ({ catalogApi: { get: mocks.catalogGet } }))
vi.mock('@/api/companies', () => ({ companiesApi: { create: mocks.companiesCreate } }))

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

function renderWizard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <CompanyOnboardingWizard open tenantKey="tenant1" onClose={vi.fn()} />
    </QueryClientProvider>,
  )
}

function selectOption(triggerName: string, optionName: string) {
  fireEvent.click(screen.getByRole('combobox', { name: triggerName }))
  fireEvent.click(screen.getByRole('option', { name: optionName }))
}

describe('CompanyOnboardingWizard', () => {
  beforeEach(() => {
    mocks.catalogGet.mockReset()
    mocks.companiesCreate.mockReset()
    mocks.catalogGet.mockResolvedValue(catalog)
    mocks.companiesCreate.mockResolvedValue({ id: 'comp1' })
  })

  it('collects selected metrics and sends them on create', async () => {
    renderWizard()

    // Step 1: name + geography
    fireEvent.change(screen.getByPlaceholderText('Название компании'), { target: { value: 'Acme' } })
    fireEvent.click(screen.getByRole('radio', { name: /Россия/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))

    // Step 2: wait for the catalog, then select industry
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Сфера деятельности' })).toBeInTheDocument())
    selectOption('Сфера деятельности', 'SaaS')
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))

    // Step 3: business model
    selectOption('Бизнес-модель', 'Подписка (SaaS)')
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))

    // Step 4: metric checkboxes are all pre-checked; uncheck one.
    await waitFor(() => expect(screen.getByText('Повторяющаяся выручка (MRR/ARR)')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('checkbox', { name: /Удержание подписчиков/ }))

    fireEvent.change(screen.getByLabelText('Валовая маржа (%)'), { target: { value: '70' } })
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    await waitFor(() => expect(mocks.companiesCreate).toHaveBeenCalled())
    const payload = mocks.companiesCreate.mock.calls[0][0]
    expect(payload.name).toBe('Acme')
    expect(payload.industry).toBe('saas')
    expect(payload.business_model).toBe('subscription')
    expect(payload.gross_margin).toBe(70)
    expect(payload.selected_metrics).not.toContain('retention_rate')
    expect(payload.selected_metrics).toEqual(
      expect.arrayContaining(['new_units', 'arpu', 'revenue', 'marketing_spend']),
    )
  })
})
