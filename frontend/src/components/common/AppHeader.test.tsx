import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme-provider'
import i18n from '@/i18n'
import { AppHeader } from './AppHeader'
import { Settings } from '@/pages/Settings'

vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ user: { fullName: 'Test User', email: 'test@example.com' } }),
}))

vi.mock('@/auth/authSession', () => ({ logout: vi.fn() }))

describe('AppHeader', () => {
  beforeEach(async () => {
    localStorage.clear()
    await i18n.changeLanguage('ru')
  })

  it('switches the header language in both directions and keeps it out of the profile menu', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider defaultTheme="dark" storageKey="startup-engine-theme">
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>,
    )

    const header = screen.getByRole('banner')
    const languageButton = within(header).getByRole('button', { name: 'Переключить язык' })
    expect(languageButton).toHaveTextContent('EN')
    expect(languageButton.parentElement?.previousElementSibling).toContainElement(
      within(header).getByRole('button', { name: 'Toggle theme' }),
    )

    await user.click(languageButton)
    expect(languageButton).toHaveTextContent('RU')
    expect(within(header).getByRole('navigation', { name: 'Global navigation' })).toBeInTheDocument()
    expect(localStorage.getItem('startup-engine-lang')).toBe('en')

    await user.click(languageButton)
    expect(languageButton).toHaveTextContent('EN')
    expect(within(header).getByRole('navigation', { name: 'Глобальная навигация' })).toBeInTheDocument()
    expect(localStorage.getItem('startup-engine-lang')).toBe('ru')

    await user.click(within(header).getByRole('button', { name: 'Аккаунт' }))
    expect(within(screen.getByRole('menu')).queryByText(/Переключить язык/)).not.toBeInTheDocument()
  })

  it('opens settings from the profile menu without a global navigation link', async () => {
    const user = userEvent.setup()
    render(
      <ThemeProvider defaultTheme="dark" storageKey="startup-engine-theme">
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppHeader />
          <Routes>
            <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).getByRole('link', { name: 'Дашборд' })).toHaveAttribute('href', '/dashboard')
    expect(within(nav).queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Аккаунт' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Настройки' }))
    expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument()
  })
})
