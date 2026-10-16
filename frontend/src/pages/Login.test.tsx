import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { Login } from './Login'

const mocks = vi.hoisted(() => ({ login: vi.fn(), me: vi.fn(), completeLogin: vi.fn() }))
vi.mock('@/api/auth', () => ({ authApi: { login: mocks.login, me: mocks.me } }))
vi.mock('@/auth/authSession', () => ({ completeLogin: mocks.completeLogin }))

function renderLogin() {
  return render(<MemoryRouter initialEntries={['/login']}><Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/dashboard" element={<h1>Portfolio</h1>} />
    <Route path="/companies/:companyId" element={<h1>Own company</h1>} />
  </Routes></MemoryRouter>)
}

function submit() {
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'test@example.com' } })
  fireEvent.change(screen.getByPlaceholderText('Пароль'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
}

describe('Login session entry and error display', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    mocks.login.mockReset().mockResolvedValue({ access_token: 'token' })
    mocks.me.mockReset()
    mocks.completeLogin.mockReset()
  })

  it.each([
    ['fund', null, 'Portfolio'],
    ['investor', null, 'Portfolio'],
    ['startup', 'own', 'Own company'],
    ['startup', null, 'Portfolio'],
  ] as const)('navigates %s with binding %s after authoritative me', async (productRole, companyId, heading) => {
    const user = { id: 'u', organizationId: 'tenant', productRole, companyId }
    mocks.me.mockResolvedValue(user)
    renderLogin()
    submit()
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible()
    expect(mocks.completeLogin).toHaveBeenCalledWith(user)
  })

  it('renders credentials and 422 validation errors without a React child exception', async () => {
    mocks.login.mockRejectedValueOnce({ response: { data: { detail: 'Incorrect email or password' } } })
      .mockRejectedValueOnce({ response: { data: { detail: [{ loc: ['body', 'email'], msg: 'Invalid email', type: 'value_error' }] } } })
    renderLogin()
    submit()
    expect(await screen.findByText('Incorrect email or password')).toBeVisible()
    submit()
    expect(await screen.findByText('Invalid email')).toBeVisible()
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument()
    expect(mocks.me).not.toHaveBeenCalled()
  })

  it('renders network fallback and does not publish a session', async () => {
    mocks.login.mockRejectedValue(new Error('Network Error'))
    renderLogin()
    submit()
    expect(await screen.findByText('Network Error')).toBeVisible()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Войти' })).toBeEnabled())
    expect(mocks.completeLogin).not.toHaveBeenCalled()
  })
})
