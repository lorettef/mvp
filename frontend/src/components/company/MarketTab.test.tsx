import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarketTab } from './MarketTab'
import type { MarketAnalysisResponse } from '@/types/api'

const marketData: MarketAnalysisResponse = {
  industry: 'saas',
  industryLabel: 'SaaS',
  geography: 'RU',
  geographyLabel: 'Россия',
  horizon: 3,
  macro: { gdpGrowth: 3.5, inflation: 8.5, keyRate: 21.0 },
  marketSize: 300,
  marketSizeProjected: 456.3,
  marketGrowth: 15,
  trends: ['Сдвиг к AI-функциям', 'Рост product-led growth'],
  impact: { mrrFactor: 1.01, cacFactor: 1.09, churnFactor: 1.04 },
  summary: 'SaaS в географии «Россия»: объём рынка ≈ 300 ₽ млрд.',
}

describe('MarketTab', () => {
  it('renders the analysis form', () => {
    render(<MarketTab data={null} isLoading={false} onAnalyze={vi.fn()} />)
    expect(screen.getByLabelText('Сфера деятельности')).toBeInTheDocument()
    expect(screen.getByLabelText('География')).toBeInTheDocument()
    expect(screen.getByLabelText('Горизонт')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Анализировать' })).toBeInTheDocument()
  })

  it('calls onAnalyze with the selected form values', () => {
    const onAnalyze = vi.fn()
    render(<MarketTab data={null} isLoading={false} onAnalyze={onAnalyze} />)
    fireEvent.change(screen.getByLabelText('Сфера деятельности'), { target: { value: 'fintech' } })
    fireEvent.change(screen.getByLabelText('География'), { target: { value: 'KZ' } })
    fireEvent.change(screen.getByLabelText('Горизонт'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Анализировать' }))
    expect(onAnalyze).toHaveBeenCalledWith({ industry: 'fintech', geography: 'KZ', horizon: 2 })
  })

  it('renders macro, market size, impact, trends and summary', () => {
    render(<MarketTab data={marketData} isLoading={false} onAnalyze={vi.fn()} />)
    expect(screen.getByText('Макроэкономика')).toBeInTheDocument()
    expect(screen.getByText('+3.5%')).toBeInTheDocument()
    expect(screen.getByText('Объём рынка (SaaS)')).toBeInTheDocument()
    expect(screen.getByText('₽300 млрд')).toBeInTheDocument()
    expect(screen.getByText('Влияние на метрики')).toBeInTheDocument()
    expect(screen.getByText('×1.090')).toBeInTheDocument()
    expect(screen.getByText('Тренды')).toBeInTheDocument()
    expect(screen.getByText(/Сдвиг к AI-функциям/)).toBeInTheDocument()
    expect(screen.getByText(/SaaS в географии/)).toBeInTheDocument()
  })

  it('shows skeleton while loading', () => {
    render(<MarketTab data={null} isLoading onAnalyze={vi.fn()} />)
    expect(screen.queryByText('Макроэкономика')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Анализ...' })).toBeInTheDocument()
  })
})
