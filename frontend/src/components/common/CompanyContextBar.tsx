import { useNavigate, useLocation, useSearchParams, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { getTenantKey } from '@/auth/authSession'
import { companiesApi } from '@/api/companies'
import { catalogApi } from '@/api/catalog'
import { qk } from '@/lib/queryKeys'
import { companyGroups } from '@/lib/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export function CompanyContextBar() {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const tenantKey = getTenantKey()
  const companyMatch = useMatch('/companies/:companyId')

  const isFund = user?.role === 'admin' && user?.organizationType !== 'startup'
  const pathCompanyId = companyMatch?.params.companyId
  const currentCompanyId = isFund ? pathCompanyId : (user?.companyId ?? undefined)
  const currentTab = searchParams.get('tab')
  const effectiveTab = currentTab ?? (companyMatch ? 'metrics' : null)

  const companyQuery = useQuery({
    queryKey: qk.company(tenantKey, currentCompanyId ?? ''),
    queryFn: ({ signal }) => companiesApi.get(currentCompanyId ?? '', { signal }),
    enabled: Boolean(currentCompanyId),
  })
  const companiesQuery = useQuery({
    queryKey: qk.companies(tenantKey, false),
    queryFn: ({ signal }) => companiesApi.list({ signal }),
    enabled: Boolean(isFund && currentCompanyId),
  })
  const catalogQuery = useQuery({
    queryKey: ['catalog'],
    queryFn: ({ signal }) => catalogApi.get({ signal }),
    enabled: !isFund,
  })

  if (!currentCompanyId) return null

  const company = companyQuery.data
  const activeCompanies = companiesQuery.data ?? []

  const tabHref = (tab: string) => `/companies/${currentCompanyId}?tab=${tab}`

  const industryLabel = (slug: string | null) =>
    slug ? (catalogQuery.data?.industries.find((i) => i.slug === slug)?.label ?? slug) : null
  const businessModelLabel = (slug: string | null) =>
    slug ? (catalogQuery.data?.business_models.find((b) => b.slug === slug)?.label ?? slug) : null

  const groupActive = (group: (typeof companyGroups)[number]) => {
    if (group.startupOnly) return location.pathname === '/dashboard'
    if (group.children) return group.children.some((c) => c.tab === effectiveTab)
    return group.tab === effectiveTab
  }

  const itemClass = (active: boolean) =>
    cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
    )

  const groups = companyGroups.filter((g) => !g.startupOnly || !isFund)
  const allLeaves = companyGroups.flatMap((g) =>
    g.children ? g.children : g.tab ? [{ key: g.key, labelKey: g.labelKey, tab: g.tab }] : [],
  )

  return (
    <div className="sticky top-14 z-20 flex h-11 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur sm:px-6">
      {/* Switcher (fund) or static identity (startup) */}
      {isFund ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/60"
              aria-label={t('nav.switchCompany')}
            >
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="max-w-[10rem] truncate">{company?.name ?? '—'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuItem onClick={() => navigate('/dashboard')}>
              {t('nav.backToPortfolio')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {activeCompanies.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => navigate(`/companies/${c.id}`)}>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                {c.id === currentCompanyId && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex shrink-0 items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium text-foreground">{company?.name ?? user?.companyName}</span>
          {(company?.industry || company?.businessModel) && (
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">
              {[industryLabel(company.industry), businessModelLabel(company.businessModel)].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}

      {/* Grouped company navigation */}
      <nav
        aria-label={t('nav.companyLabel')}
        className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {groups.map((group) => {
          const active = groupActive(group)
          if (group.children) {
            return (
              <DropdownMenu key={group.key}>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={itemClass(active)}>
                    {t(group.labelKey)}
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  {group.children.map((child) => (
                    <DropdownMenuItem key={child.key} onClick={() => navigate(tabHref(child.tab))}>
                      <span className="min-w-0 flex-1">{t(child.labelKey)}</span>
                      {child.tab === effectiveTab && <Check className="h-4 w-4 text-primary" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
          if (group.startupOnly) {
            return (
              <a
                key={group.key}
                href="/dashboard"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/dashboard')
                }}
                aria-current={active ? 'page' : undefined}
                className={itemClass(active)}
              >
                {t(group.labelKey)}
              </a>
            )
          }
          return (
            <a
              key={group.key}
              href={tabHref(group.tab!)}
              onClick={(e) => {
                e.preventDefault()
                navigate(tabHref(group.tab!))
              }}
              aria-current={active ? 'page' : undefined}
              className={itemClass(active)}
            >
              {t(group.labelKey)}
            </a>
          )
        })}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(itemClass(false), 'lg:hidden')}>
              {t('nav.more')}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {allLeaves.map((leaf) => (
              <DropdownMenuItem key={leaf.tab} onClick={() => navigate(tabHref(leaf.tab))}>
                <span className="min-w-0 flex-1">{t(leaf.labelKey)}</span>
                {leaf.tab === effectiveTab && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </div>
  )
}
