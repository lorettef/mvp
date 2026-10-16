import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { authApi } from '@/api/auth'
import { completeLogin, getTenantKey } from '@/auth/authSession'
import { CompanyOnboardingWizard } from '@/components/company/CompanyOnboardingWizard'
import { PageHeader } from '@/components/shared/page-header'
import { getDefaultRoute } from '@/lib/defaultRoute'

/** Reuses the existing first-company wizard for an unbound startup account. */
export function StartupProvisioning() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return <div className="mx-auto max-w-4xl space-y-6">
    <PageHeader title={t('dashboard.addCompany')} />
    <CompanyOnboardingWizard
      open
      tenantKey={getTenantKey()}
      onClose={() => undefined}
      onCreated={async () => {
        const user = await authApi.me()
        completeLogin(user)
        navigate(getDefaultRoute(user) ?? '/dashboard', { replace: true })
      }}
    />
  </div>
}
