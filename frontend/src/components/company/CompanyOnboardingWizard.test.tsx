import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CompanyOnboardingWizard } from './CompanyOnboardingWizard'
import type { CatalogResponse } from '@/types/api'
import i18n from '@/i18n'

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
          metric('revenue', 'Выручка (Revenue)'),
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
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    mocks.catalogGet.mockReset()
    mocks.companiesCreate.mockReset()
    mocks.catalogGet.mockResolvedValue(catalog)
    mocks.companiesCreate.mockResolvedValue({ id: 'comp1' })
  })

  it('shows the add company title in Russian and English', async () => {
    renderWizard()
    expect(screen.getByText('Добавить компанию')).toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(screen.getByText('Add company')).toBeInTheDocument()
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
    await waitFor(() => expect(screen.getByText('Выручка (Revenue)')).toBeInTheDocument())
    expect(screen.getByText('Отметьте метрики, которые будете отслеживать. Список можно изменить позже.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('checkbox', { name: /Удержание подписчиков/ }))

    const grossMarginInput = screen.getByRole('spinbutton', { name: 'Валовая маржа (%)' })
    expect(grossMarginInput).toHaveValue(null)
    expect(grossMarginInput).toHaveAttribute('placeholder', 'Например, 70')
    expect(screen.getByRole('button', { name: 'Создать' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))
    expect(mocks.companiesCreate).not.toHaveBeenCalled()

    await act(async () => {
      await i18n.changeLanguage('en')
    })
    expect(screen.getByRole('spinbutton', { name: 'Gross margin (%)' })).toHaveAttribute('placeholder', 'For example, 70')
    await act(async () => {
      await i18n.changeLanguage('ru')
    })

    fireEvent.change(grossMarginInput, { target: { value: '65' } })
    expect(grossMarginInput).toHaveValue(65)
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }))
    expect(screen.getByText('Шаг 3 из 4')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.getByRole('spinbutton', { name: 'Валовая маржа (%)' })).toHaveValue(65)
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }))

    await waitFor(() => expect(mocks.companiesCreate).toHaveBeenCalled())
    const payload = mocks.companiesCreate.mock.calls[0][0]
    expect(payload.name).toBe('Acme')
    expect(payload.industry).toBe('saas')
    expect(payload.business_model).toBe('subscription')
    expect(payload.gross_margin).toBe(0.65)
    expect(payload.selected_metrics).not.toContain('retention_rate')
    expect(payload.selected_metrics).toEqual(
      expect.arrayContaining(['new_units', 'arpu', 'revenue', 'marketing_spend']),
    )
  })
})
