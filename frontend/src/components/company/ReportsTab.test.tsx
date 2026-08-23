import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ReportsTab } from './ReportsTab'

describe('ReportsTab', () => {
  it('renders download links with correct hrefs', () => {
    render(<ReportsTab companyId="comp1" />)
    expect(screen.getByText('Отчёты для инвесторов')).toBeInTheDocument()

    const pdf = screen.getByRole('link', { name: /Скачать PDF/ })
    expect(pdf).toHaveAttribute('href', '/api/v1/companies/comp1/report/pdf')

    const excel = screen.getByRole('link', { name: /Скачать Excel/ })
    expect(excel).toHaveAttribute('href', '/api/v1/companies/comp1/report/excel')
  })
})
