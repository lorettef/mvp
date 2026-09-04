import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { Register } from './Register'

const authApiMock = vi.hoisted(() => ({
  register: vi.fn(),
}))

const invitesApiMock = vi.hoisted(() => ({
  get: vi.fn(),
}))

const analyticsMock = vi.hoisted(() => ({
  track: vi.fn(),
}))

vi.mock('@/api/auth', () => ({ authApi: authApiMock }))
vi.mock('@/api/invites', () => ({ invitesApi: invitesApiMock }))
vi.mock('@/api/analytics', () => ({ analytics: analyticsMock }))

function renderRegister(initialEntry = '/register') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Register />
    </MemoryRouter>,
  )
}

function fillCommonFields() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'founder@example.com' } })
  fireEvent.change(screen.getByLabelText('Пароль (мин. 8 символов)'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: 'Алексей' } })
}

describe('Register', () => {
  beforeEach(() => {
    authApiMock.register.mockReset()
    authApiMock.register.mockResolvedValue({ tokenType: 'bearer', expiresIn: 3600 })
    invitesApiMock.get.mockReset()
    analyticsMock.track.mockReset()
  })

  it('sends the fund payload without an account type by default', async () => {
    renderRegister()
    fillCommonFields()
    fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star Ventures' } })

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: 'founder@example.com',
        password: 'password123',
        full_name: 'Алексей',
        company_name: 'North Star Ventures',
      })
    })
  })

  it('sends the startup account type and startup name', async () => {
    renderRegister()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Стартап' }))
    fillCommonFields()
    fireEvent.change(screen.getByLabelText('Название стартапа'), { target: { value: 'Orbit Labs' } })

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: 'founder@example.com',
        password: 'password123',
        full_name: 'Алексей',
        company_name: 'Orbit Labs',
        account_type: 'startup',
      })
    })
  })

  it('sends industry and geography for a startup', async () => {
    renderRegister()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Стартап' }))
    fillCommonFields()
    fireEvent.change(screen.getByLabelText('Название стартапа'), { target: { value: 'Orbit Labs' } })
    fireEvent.change(screen.getByLabelText('Сфера деятельности'), { target: { value: 'saas' } })
    fireEvent.change(screen.getByLabelText('Местоположение'), { target: { value: 'Россия' } })

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: 'founder@example.com',
        password: 'password123',
        full_name: 'Алексей',
        company_name: 'Orbit Labs',
        account_type: 'startup',
        industry: 'saas',
        geography: 'Россия',
      })
    })
  })

  it('shows a client validation error and does not submit an empty startup name', async () => {
    renderRegister()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Стартап' }))
    fillCommonFields()

    fireEvent.submit(screen.getByRole('form', { name: 'Регистрация' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Укажите название стартапа')
    expect(authApiMock.register).not.toHaveBeenCalled()
  })

  it('loads the invite banner and sends the invite token for an invited startup', async () => {
    invitesApiMock.get.mockResolvedValue({
      organizationName: 'North Star Ventures',
      email: 'founder@example.com',
    })

    renderRegister('/register?invite=invite-token')

    expect(await screen.findByText('Вас пригласили в фонд «North Star Ventures»')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Стартап' })).toHaveAttribute('aria-selected', 'true')
    fillCommonFields()
    fireEvent.change(screen.getByLabelText('Название стартапа'), { target: { value: 'Orbit Labs' } })

    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalledWith({
        email: 'founder@example.com',
        password: 'password123',
        full_name: 'Алексей',
        company_name: 'Orbit Labs',
        account_type: 'startup',
        invite_token: 'invite-token',
      })
    })
  })
})
