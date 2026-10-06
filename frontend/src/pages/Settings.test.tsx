import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { useAuthStore, type User } from '@/store/authStore'
import { Settings } from './Settings'

const profile: User = {
  id: 'profile-user',
  email: 'profile@example.com',
  fullName: 'Test User',
  companyName: 'Test Fund',
  role: 'admin',
  organizationId: 'profile-org',
  companyId: null,
  subscriptionPlan: 'pro',
  dailyLimit: null,
  usedToday: 0,
}

describe('Settings', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: profile })
  })

  it.each([
    { language: 'ru', title: 'Настройки', section: 'Профиль', email: 'Email:', company: 'Компания:', name: 'Имя:', logout: 'Выйти' },
    { language: 'en', title: 'Settings', section: 'Profile', email: 'Email:', company: 'Company:', name: 'Name:', logout: 'Sign out' },
  ])('shows the read-only profile without logout in $language', async (labels) => {
    await i18n.changeLanguage(labels.language)
    const { container } = render(<Settings />)

    expect(screen.getByRole('heading', { level: 1, name: labels.title })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: labels.section })).toBeInTheDocument()
    for (const [label, value] of [[labels.email, profile.email], [labels.company, profile.companyName], [labels.name, profile.fullName]]) {
      expect(screen.getByText(label).parentElement).toHaveTextContent(value)
    }
    expect(screen.queryByRole('button', { name: labels.logout })).not.toBeInTheDocument()
    expect(screen.queryByText(labels.logout)).not.toBeInTheDocument()
    expect(container.querySelector('input, textarea, select')).not.toBeInTheDocument()
  })

  it.each([
    { language: 'ru', company: 'Компания:', name: 'Имя:', missingCompany: 'Не указана', missingName: 'Не указано' },
    { language: 'en', company: 'Company:', name: 'Name:', missingCompany: 'Not specified', missingName: 'Not specified' },
  ])('preserves missing company and name fallbacks in $language', async (labels) => {
    useAuthStore.setState({ user: { ...profile, companyName: '', fullName: '' } })
    await i18n.changeLanguage(labels.language)
    render(<Settings />)

    expect(screen.getByText(labels.company).parentElement).toHaveTextContent(labels.missingCompany)
    expect(screen.getByText(labels.name).parentElement).toHaveTextContent(labels.missingName)
  })
})
