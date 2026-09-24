import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import type { CatalogResponse, Company } from '@/types/api'
import { StartupKpi } from './StartupKpi'

const metricKeys = ['ltv', 'arpu', 'retention_rate', 'cac', 'churn']
const labels = ['LTV (₽)', 'ARPU (₽)', 'Retention (%)', 'CAC (₽)', 'Churn (%)']
const catalog: CatalogResponse = {
  industries: [{ slug: 'saas', label: 'SaaS' }],
  business_models: [{ slug: 'subscription', label: 'Subscription', description: '' }],
  profiles: {
    saas: {
      subscription: {
        label: 'Subscription',
        why: '',
        metrics: metricKeys.map((key, index) => ({ key, label: labels[index], required: true, why: '' })),
        derived: [],
      },
    },
  },
}
const company: Company = {
  id: 'company-1',
  organizationId: 'org-1',
  name: 'Example',
  industry: 'saas',
  businessModel: 'subscription',
  geography: 'Russia',
  grossMargin: 0.7,
  selectedMetrics: metricKeys,
  archivedAt: null,
  createdAt: '2026-09-24T00:00:00Z',
}

afterEach(async () => {
  cleanup()
  await i18n.changeLanguage('ru')
})

describe('StartupKpi metric help', () => {
  it.each([
    ['ru', ['Ожидаемая суммарная выручка', 'Средняя выручка', 'Доля клиентов, которые продолжают', 'Средняя стоимость привлечения', 'Доля клиентов, которые перестали']],
    ['en', ['Estimated total revenue', 'Average revenue', 'Share of customers who continue', 'Average cost of acquiring', 'Share of customers who stop']],
  ])('shows the matching %s explanation for all five metrics', async (language, descriptions) => {
    await i18n.changeLanguage(language)
    render(<StartupKpi company={company} catalog={catalog} metrics={[]} unitEconomics={undefined} />)

    for (const [index, label] of labels.entries()) {
      fireEvent.click(screen.getByRole('button', { name: label }))
      expect(await screen.findByText(new RegExp(descriptions[index]))).toBeVisible()
    }
    expect(screen.getAllByText('—')).toHaveLength(5)
  })
})
