import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Register } from './Register'

const mocks = vi.hoisted(() => ({ register: vi.fn(), me: vi.fn(), invite: vi.fn(), track: vi.fn(), completeLogin: vi.fn() }))
vi.mock('@/api/auth', () => ({ authApi: { register: mocks.register, me: mocks.me } }))
vi.mock('@/api/invites', () => ({ invitesApi: { get: mocks.invite } }))
vi.mock('@/api/analytics', () => ({ analytics: { track: mocks.track } }))
vi.mock('@/auth/authSession', () => ({ completeLogin: mocks.completeLogin }))

const fundUser = { id: 'u1', email: 'founder@example.com', fullName: 'Алексей', companyName: 'North Star', role: 'admin', productRole: 'fund', organizationId: 'o1', companyId: null, createdAt: '', subscriptionPlan: 'starter', dailyLimit: 1, usedToday: 0, organizationType: 'fund' }
const Path = () => <div data-testid="path">{useLocation().pathname}</div>

function renderRegister(initialEntry = '/register') {
  return render(<MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="*" element={<><Register /><Path /></>} /></Routes></MemoryRouter>)
}

function fillValid({ email = true } = {}) {
  if (email) fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'founder@example.com' } })
  fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'Password123' } })
  fireEvent.change(screen.getByLabelText('Повторите пароль'), { target: { value: 'Password123' } })
  fireEvent.change(screen.getByLabelText('Ваше имя'), { target: { value: 'Алексей' } })
}

describe('Register', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.register.mockResolvedValue(fundUser)
    mocks.me.mockResolvedValue(fundUser)
  })

  it('shows live canonical password requirements and blocks a weak password', async () => {
    renderRegister(); fillValid()
    fireEvent.change(screen.getByLabelText('Пароль'), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    expect(screen.getByText('Одна заглавная буква')).toBeVisible()
    fireEvent.submit(screen.getByRole('form', { name: 'Регистрация' }))
    expect(await screen.findByText('Пароль не соответствует требованиям')).toBeVisible()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('blocks mismatched confirmation without POST', async () => {
    renderRegister(); fillValid()
    fireEvent.change(screen.getByLabelText('Повторите пароль'), { target: { value: 'Password124' } })
    fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Регистрация' }))
    expect(await screen.findByText('Пароли не совпадают')).toBeVisible()
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it('submits a valid fund without stale startup fields, then creates session and routes', async () => {
    renderRegister(); fillValid()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Стартап' }))
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Сфера деятельности' })); await user.click(await screen.findByRole('option', { name: 'SaaS' }))
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Венчурный фонд' }))
    fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    fireEvent.click(screen.getByRole('button', { name: 'Зарегистрироваться' }))
    await waitFor(() => expect(mocks.register).toHaveBeenCalledWith({ email: 'founder@example.com', password: 'Password123', full_name: 'Алексей', company_name: 'North Star' }))
    expect(mocks.me).toHaveBeenCalledTimes(1); expect(mocks.completeLogin).toHaveBeenCalledWith(fundUser)
    await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent('/dashboard'))
  })

  it('maps FastAPI 422 arrays to the corresponding field', async () => {
    mocks.register.mockRejectedValue({ response: { status: 422, data: { detail: [{ loc: ['body', 'password'], msg: 'Server password reason', type: 'value_error' }] } } })
    renderRegister(); fillValid(); fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Регистрация' }))
    expect(await screen.findByText('Server password reason')).toBeVisible()
  })

  it('shows duplicate 409 beside email with a login action', async () => {
    mocks.register.mockRejectedValue({ response: { status: 409, data: { detail: 'Аккаунт с таким email уже существует' } } })
    renderRegister(); fillValid(); fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Регистрация' }))
    expect(await screen.findByText('Аккаунт с таким email уже существует')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Войти в существующий аккаунт' })).toHaveAttribute('href', '/login')
  })

  it.each([
    [{ response: { status: 429, data: { detail: 'Rate limit exceeded' }, headers: { 'retry-after': '45' } } }, /Слишком много попыток.*45/],
    [new Error('Network Error'), /Не удалось связаться с сервером/],
  ])('normalizes rate-limit and network failures', async (failure, expected) => {
    if (failure instanceof Error) Object.assign(failure, { isAxiosError: true })
    mocks.register.mockRejectedValue(failure)
    renderRegister(); fillValid(); fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Регистрация' }))
    expect(await screen.findByText(expected)).toBeVisible()
  })

  it('prevents a second POST while registration is pending', async () => {
    mocks.register.mockImplementation(() => new Promise<void>(() => undefined))
    renderRegister(); fillValid(); fireEvent.change(screen.getByLabelText('Название фонда'), { target: { value: 'North Star' } })
    const submit = screen.getByRole('button', { name: 'Зарегистрироваться' })
    fireEvent.click(submit); fireEvent.click(submit)
    expect(mocks.register).toHaveBeenCalledTimes(1); expect(submit).toBeDisabled()
  })

  it('locks invited startup role and pre-fills a bound read-only email', async () => {
    mocks.invite.mockResolvedValue({ organizationName: 'North Star', email: 'bound@example.com' })
    renderRegister('/register?invite=token')
    expect(await screen.findByText('Вас пригласили в фонд «North Star»')).toBeVisible()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('bound@example.com'); expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
  })

  it('disables invalid invitations and offers clean registration', async () => {
    mocks.invite.mockRejectedValue({ response: { status: 404 } })
    renderRegister('/register?invite=bad')
    expect(await screen.findByText('Приглашение недействительно или истекло')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Зарегистрироваться' })).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Зарегистрироваться без приглашения' })).toHaveAttribute('href', '/register')
  })
})
