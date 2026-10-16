import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '@/components/theme-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18n from '@/i18n'
import { AppHeader } from './AppHeader'
import { Settings } from '@/pages/Settings'

const headerAuth = vi.hoisted(() => ({ user: { fullName: 'Test User', email: 'test@example.com', role: 'company', productRole: 'startup', organizationType: 'startup', organizationId: 'org', companyId: 'own' } }))
vi.mock('@/store/authStore', () => ({ useAuthStore: () => ({ user: headerAuth.user }) }))

vi.mock('@/auth/authSession', () => ({ logout: vi.fn() }))
const invites = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@/api/invites', () => ({ invitesApi: invites }))

describe('AppHeader', () => {
  beforeEach(async () => {
    headerAuth.user = { fullName: 'Test User', email: 'test@example.com', role: 'company', productRole: 'startup', organizationType: 'startup', organizationId: 'org', companyId: 'own' }
    localStorage.clear()
    await i18n.changeLanguage('ru')
  })

  function renderHeader(path = '/dashboard') {
    return render(<QueryClientProvider client={new QueryClient()}><ThemeProvider defaultTheme="dark"><MemoryRouter initialEntries={[path]}><AppHeader /></MemoryRouter></ThemeProvider></QueryClientProvider>)
  }

  it('shares fund Home/Companies links between desktop and mobile and keeps the logo target', async () => {
    headerAuth.user = { ...headerAuth.user, role: 'admin', productRole: 'fund', organizationType: 'fund' }
    renderHeader('/companies/comp1')
    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).getByRole('link', { name: 'Дашборд портфеля' })).toHaveAttribute('href', '/dashboard')
    expect(within(nav).getByRole('link', { name: 'Компании' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Компании' })).toHaveAttribute('href', '/companies')
    expect(within(nav).getByRole('link', { name: 'Дашборд портфеля' })).not.toHaveAttribute('aria-current')
    expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Дашборд портфеля', 'Компании'])
    expect(within(nav).getByRole('button', { name: 'Пригласить стартап' })).toBeInTheDocument()
    expect(Array.from(nav.children).map(item => item.textContent)).toEqual(['Дашборд портфеля', 'Компании', 'Пригласить стартап'])
    expect(screen.getByRole('link', { name: 'Startup Investment Bridge' })).toHaveAttribute('href', '/dashboard')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Переключить меню' }))
    const mobile = within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(mobile).getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Дашборд портфеля', '/dashboard'], ['Компании', '/companies'],
    ])
    expect(within(mobile).getByRole('link', { name: 'Компании' })).toHaveAttribute('aria-current', 'page')
    expect(within(mobile).getByRole('button', { name: 'Пригласить стартап' })).toBeInTheDocument()
    expect(within(mobile).queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument()
  })

  it('hides all portfolio entries and Invite for startup in both navigation presentations', async () => {
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).queryByRole('link')).not.toBeInTheDocument()
    expect(within(nav).queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Компании' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Переключить меню' }))
    expect(within(screen.getByRole('dialog')).queryByRole('link', { name: 'Компании' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
  })

  it('keeps investor portfolio links while excluding Invite in desktop and mobile', async () => {
    headerAuth.user = { ...headerAuth.user, role: 'observer', productRole: 'investor', organizationType: 'fund' }
    renderHeader('/companies')
    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).getAllByRole('link').map(link => link.textContent)).toEqual(['Дашборд портфеля', 'Компании'])
    expect(within(nav).getByRole('link', { name: 'Компании' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Переключить меню' }))
    const mobile = within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(mobile).getAllByRole('link')).toHaveLength(2)
    expect(within(mobile).queryByRole('button', { name: 'Пригласить стартап' })).not.toBeInTheDocument()
  })

  it('opens one shared Fund Invite dialog from desktop and mobile actions', async () => {
    headerAuth.user = { ...headerAuth.user, role: 'admin', productRole: 'fund', organizationType: 'fund' }
    invites.create.mockReset().mockResolvedValue({ token: 'one-link' })
    renderHeader('/dashboard')
    const desktop = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    await userEvent.setup().click(within(desktop).getByRole('button', { name: 'Пригласить стартап' }))
    expect(screen.getAllByRole('dialog', { name: 'Пригласить стартап' })).toHaveLength(1)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Создать ссылку' }))
    expect(await screen.findByDisplayValue(/\/invite\/one-link/)).toBeInTheDocument()
    expect(invites.create).toHaveBeenCalledTimes(1)
    await userEvent.setup().click(within(screen.getByRole('dialog', { name: 'Пригласить стартап' })).getByRole('button', { name: 'Отмена' }))
    await userEvent.setup().click(screen.getByRole('button', { name: 'Переключить меню' }))
    const mobile = within(screen.getByRole('dialog')).getByRole('navigation', { name: 'Глобальная навигация' })
    await userEvent.setup().click(within(mobile).getByRole('button', { name: 'Пригласить стартап' }))
    expect(screen.getAllByRole('dialog', { name: 'Пригласить стартап' })).toHaveLength(1)
  })

  it('localizes the fund links without changing startup dashboard terminology', async () => {
    headerAuth.user = { ...headerAuth.user, role: 'admin', productRole: 'fund', organizationType: 'fund' }
    await i18n.changeLanguage('en')
    renderHeader()
    const nav = screen.getByRole('navigation', { name: 'Global navigation' })
    expect(within(nav).getByRole('link', { name: 'Portfolio Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Companies' })).toHaveAttribute('href', '/companies')
  })

  it('switches the header language in both directions and keeps it out of the profile menu', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider defaultTheme="dark" storageKey="startup-engine-theme">
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppHeader />
        </MemoryRouter>
      </ThemeProvider>
      </QueryClientProvider>,
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
      <QueryClientProvider client={new QueryClient()}>
      <ThemeProvider defaultTheme="dark" storageKey="startup-engine-theme">
        <MemoryRouter initialEntries={['/dashboard']}>
          <AppHeader />
          <Routes>
            <Route path="/dashboard" element={<h1>Dashboard page</h1>} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
      </QueryClientProvider>,
    )

    const nav = screen.getByRole('navigation', { name: 'Глобальная навигация' })
    expect(within(nav).queryByRole('link')).not.toBeInTheDocument()
    expect(within(nav).queryByRole('link', { name: 'Настройки' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Аккаунт' }))
    await user.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Настройки' }))
    expect(await screen.findByRole('heading', { name: 'Настройки' })).toBeInTheDocument()
  })
})
