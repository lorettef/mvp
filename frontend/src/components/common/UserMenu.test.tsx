import { QueryClient } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authApi } from '@/api/auth'
import { registerQueryClient } from '@/auth/authSession'
import { ThemeProvider } from '@/components/theme-provider'
import i18n from '@/i18n'
import { Settings } from '@/pages/Settings'
import { useAuthStore, type User } from '@/store/authStore'
import { ProtectedRoute } from './ProtectedRoute'
import { UserMenu } from './UserMenu'

vi.mock('@/api/auth', () => ({ authApi: { logout: vi.fn().mockResolvedValue(undefined) } }))

const profile: User = {
  id: 'menu-user',
  email: 'menu@example.com',
  fullName: 'Menu User',
  companyName: 'Menu Fund',
  role: 'admin',
  organizationId: 'menu-org',
  companyId: null,
  subscriptionPlan: 'pro',
  dailyLimit: null,
  usedToday: 0,
}

function renderMenu(initialEntry = '/dashboard') {
  return render(
    <ThemeProvider defaultTheme="light" storageKey="startup-engine-theme">
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/login" element={<h1>Login page</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<UserMenu />} />
            <Route path="/settings" element={<><UserMenu /><Settings /></>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  )
}

describe('UserMenu', () => {
  let queryClient: QueryClient

  beforeEach(async () => {
    vi.clearAllMocks()
    localStorage.clear()
    useAuthStore.setState({ user: profile })
    queryClient = new QueryClient()
    registerQueryClient(queryClient)
    await i18n.changeLanguage('ru')
  })

  it.each([
    { language: 'ru', account: 'Аккаунт', settings: 'Настройки', theme: 'Тема: светлая', logout: 'Выйти' },
    { language: 'en', account: 'Account', settings: 'Settings', theme: 'Theme: light', logout: 'Sign out' },
  ])('opens the profile and routes its single Settings action in $language', async (labels) => {
    await i18n.changeLanguage(labels.language)
    const user = userEvent.setup()
    renderMenu()

    const trigger = screen.getByRole('button', { name: labels.account })
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(trigger)

    const menu = screen.getByRole('menu')
    expect(within(menu).getByText(profile.fullName)).toBeInTheDocument()
    expect(within(menu).getByText(profile.email)).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: labels.theme })).toBeInTheDocument()
    expect(within(menu).getByRole('menuitem', { name: labels.logout })).toBeInTheDocument()
    const actions = within(menu).getAllByRole('menuitem', { name: labels.settings })
    expect(actions).toHaveLength(1)
    expect(actions[0]).toHaveAttribute('href', '/settings')
    await user.click(actions[0])
    expect(await screen.findByRole('heading', { level: 1, name: labels.settings })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens the menu and activates Settings with the keyboard', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Аккаунт' })).toHaveFocus()
    await user.keyboard('{Enter}')
    const settings = await screen.findByRole('menuitem', { name: 'Настройки' })
    await waitFor(() => expect(settings).toHaveFocus())
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Настройки' })).toBeInTheDocument()
  })

  it('toggles the existing theme in both directions', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button', { name: 'Аккаунт' }))
    await user.click(screen.getByRole('menuitem', { name: 'Тема: светлая' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem('startup-engine-theme')).toBe('dark')
    await user.click(screen.getByRole('button', { name: 'Аккаунт' }))
    await user.click(screen.getByRole('menuitem', { name: 'Тема: тёмная' }))
    expect(document.documentElement).toHaveClass('light')
    expect(localStorage.getItem('startup-engine-theme')).toBe('light')
  })

  it.each(['pointer', 'keyboard'])('logs out from Settings via %s and clears the session and cache', async (input) => {
    queryClient.setQueryData(['dashboard', profile.organizationId], { privateData: true })
    const user = userEvent.setup()
    renderMenu('/settings')
    if (input === 'keyboard') {
      await user.tab()
      await user.keyboard('{ArrowDown}')
      await screen.findByRole('menu')
      await user.keyboard('{End}')
      await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Выйти' })).toHaveFocus())
      await user.keyboard('{Enter}')
    } else {
      await user.click(screen.getByRole('button', { name: 'Аккаунт' }))
      await user.click(screen.getByRole('menuitem', { name: 'Выйти' }))
    }

    expect(await screen.findByRole('heading', { name: 'Login page' })).toBeInTheDocument()
    expect(authApi.logout).toHaveBeenCalledTimes(1)
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('auth-storage')).toBeNull()
    expect(queryClient.getQueriesData({})).toHaveLength(0)
  })

  it('opens Settings directly with a closed menu for an authenticated user', () => {
    renderMenu('/settings')
    expect(screen.getByRole('heading', { level: 1, name: 'Настройки' })).toBeInTheDocument()
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('guards a direct Settings visit without a session', () => {
    useAuthStore.setState({ user: null })
    renderMenu('/settings')
    expect(screen.getByRole('heading', { name: 'Login page' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Настройки' })).not.toBeInTheDocument()
  })
})
