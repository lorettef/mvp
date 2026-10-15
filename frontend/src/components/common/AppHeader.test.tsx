import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme-provider'
import i18n from '@/i18n'
import { AppHeader } from './AppHeader'
import { Settings } from '@/pages/Settings'

const headerAuth = vi.hoisted(() => ({ user: { fullName: 'Test User', email: 'test@example.com', role: 'company', organizationType: 'startup' } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: headerAuth.user }) }))

vi.mock('@/auth/authSession', () => ({ logout: vi.fn() }))

describe('AppHeader', () => {
  beforeEach(async () => {
    headerAuth.user = { fullName: 'Test User', email: 'test@example.com', role: 'company', organizationType: 'startup' }
    localStorage.clear()
    await i18n.changeLanguage('ru')
  })

  function renderHeader(path = '/dashboard') {
    return render(<ThemeProvider defaultTheme="dark"><MemoryRouter initialEntries={[path]}><AppHeader /></MemoryRouter></ThemeProvider>)
  }

  it('shares fund Home/Companies links between desktop and mobile and keeps the logo target', async () => {
    headerAuth.user = { ...headerAuth.user, role: 'admin', organizationType: 'fund' }
    renderHeader('/companies/comp1')
    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).getByRole('link', { name: 'Главная' })).toHaveAttribute('href', '/dashboard')
    expect(within(nav).getByRole('link', { name: 'Компании' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Компании' })).toHaveAttribute('href', '/companies')
    expect(within(nav).getByRole('link', { name: 'Главная' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Startup Investment Bridge' })).toHaveAttribute('href', '/dashboard')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Переключить меню' }))
    const mobile = within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(mobile).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Главная', '/dashboard'], ['Компании', '/companies'],
    ])
    expect(within(mobile).getByRole('link', { name: 'Компании' })).toHaveAttribute('aria-current', 'page')
    expect(within(mobile).queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument()
  })

  it('hides fund Companies for startup in both navigation presentations', async () => {
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).getByRole('link', { name: 'Дашборд' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).queryByRole('link', { name: 'Компании' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Переключить меню' }))
    expect(within(screen.getByRole('dialog')).queryByRole('link', { name: 'Компании' })).not.toBeInTheDocument()
  })

  it('localizes the fund links without changing startup dashboard terminology', async () => {
    headerAuth.user = { ...headerAuth.user, role: 'admin', organizationType: 'fund' }
    await i18n.changeLanguage('en')
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Global navigation' })
    expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/companies')
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
