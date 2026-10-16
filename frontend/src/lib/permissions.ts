import type { User } from '@/store/authStore'

/** Product role is supplied by /auth/me. Missing legacy-session fields grant nothing. */
export function getPermissions(user: Pick<User, 'productRole' | 'organizationId' | 'companyId'> | null | undefined) {
  const hasTenant = Boolean(user?.organizationId)
  const fund = hasTenant && user?.productRole === 'fund'
  const startup = hasTenant && user?.productRole === 'startup'
  const investor = hasTenant && user?.productRole === 'investor'
  const canOpenCompany = (companyId: string | null | undefined) => Boolean(companyId && (fund || startup && companyId === user?.companyId))
  const canEditSourceData = (companyId: string | null | undefined) => startup && canOpenCompany(companyId)
  return {
    canViewPortfolio: fund || investor,
    canViewCompanyList: fund || investor,
    canOpenCompany,
    canEditSourceData,
    canInvite: fund,
    canUseDataEntry: canEditSourceData,
    canUseCompanyAI: canOpenCompany,
    canUsePortfolioAI: fund,
    canManagePortfolio: fund,
    canProvisionCompany: startup && !user?.companyId,
    canComment: fund,
    canCorrect: fund,
  }
}
