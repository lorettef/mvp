import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { StartupProvisioning } from './StartupProvisioning'

const mocks = vi.hoisted(() => ({ me: vi.fn(), completeLogin: vi.fn() }))
vi.mock('@/api/auth', () => ({ authApi: { me: mocks.me } }))
vi.mock('@/auth/authSession', () => ({ completeLogin: mocks.completeLogin, getTenantKey: () => 'tenant' }))
vi.mock('@/components/company/CompanyOnboardingWizard', () => ({
  CompanyOnboardingWizard: ({ onCreated }: { onCreated: (company: { id: string }) => Promise<void> }) =>
    <button onClick={() => void onCreated({ id: 'new-company' })}>Create first company</button>,
}))

describe('first startup company provisioning', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('ru')
    mocks.me.mockReset().mockResolvedValue({ organizationId: 'tenant', productRole: 'startup', companyId: 'new-company' })
    mocks.completeLogin.mockReset()
  })

  it('revalidates the binding and enters the canonical company route without a new login', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><Routes>
      <Route path="/dashboard" element={<StartupProvisioning />} />
      <Route path="/companies/:companyId" element={<h1>Own company profile</h1>} />
    </Routes></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Добавить компанию' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Create first company' }))
    expect(await screen.findByRole('heading', { name: 'Own company profile' })).toBeVisible()
    await waitFor(() => expect(mocks.completeLogin).toHaveBeenCalledWith(expect.objectContaining({ companyId: 'new-company' })))
    expect(mocks.me).toHaveBeenCalledTimes(1)
  })
})
