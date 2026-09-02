import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios, { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import { analytics } from '../api/analytics'
import { invitesApi } from '../api/invites'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type AccountType = 'fund' | 'startup'

export const Register = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
  })
  const [accountType, setAccountType] = useState<AccountType>(inviteToken ? 'startup' : 'fund')
  const [inviteOrganizationName, setInviteOrganizationName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setInviteOrganizationName(null)

    if (!inviteToken) return

    const controller = new AbortController()
    void invitesApi
      .get(inviteToken, { signal: controller.signal })
      .then((invite) => {
        if (!controller.signal.aborted) setInviteOrganizationName(invite.organizationName)
      })
      .catch((fetchError: unknown) => {
        if (!axios.isCancel(fetchError) && !controller.signal.aborted) {
          setInviteOrganizationName(null)
        }
      })

    return () => controller.abort()
  }, [inviteToken])

  const handleModeChange = (value: string) => {
    if (value === 'fund' || value === 'startup') setAccountType(value)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')

    if (accountType === 'startup' && !form.companyName.trim()) {
      setError(t('auth.register.startupNameRequired'))
      return
    }

    setLoading(true)

    try {
      await authApi.register({
        email: form.email,
        password: form.password,
        full_name: form.fullName,
        company_name: form.companyName,
        ...(accountType === 'startup' ? { account_type: 'startup' } : {}),
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      })
      analytics.track('registered')
      navigate('/login', { state: { message: t('auth.register.success') } })
    } catch (err: unknown) {
      if (err instanceof AxiosError && typeof err.response?.data?.detail === 'string') {
        setError(err.response.data.detail)
      } else {
        setError(t('auth.register.error'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border bg-card">
          <CardContent className="p-8 pt-8">
            <div className="mb-6 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 shadow-lg shadow-primary-500/25">
                <svg className="h-8 w-8 text-white" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z"
                    stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <path d="M18 22l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-2xl font-bold text-foreground">
              {t('auth.register.title')}
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {t('auth.register.subtitle')}
            </p>

            <Tabs value={accountType} onValueChange={handleModeChange} className="mt-8">
              <TabsList className="grid h-auto w-full grid-cols-2">
                <TabsTrigger value="fund">{t('auth.register.modeFund')}</TabsTrigger>
                <TabsTrigger value="startup">{t('auth.register.modeStartup')}</TabsTrigger>
              </TabsList>

              <form className="mt-6 space-y-4" aria-label={t('auth.register.title')} onSubmit={handleSubmit}>
                {inviteOrganizationName && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-600" role="status">
                    {t('auth.register.inviteBanner', { name: inviteOrganizationName })}
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-destructive" role="alert">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="register-email" className="text-sm font-medium text-foreground">{t('auth.register.email')}</label>
                  <Input
                    id="register-email"
                    type="email"
                    required
                    placeholder={t('auth.register.email')}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="bg-card border-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-password" className="text-sm font-medium text-foreground">{t('auth.register.password')}</label>
                  <Input
                    id="register-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder={t('auth.register.password')}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="bg-card border-input"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="register-name" className="text-sm font-medium text-foreground">{t('auth.register.name')}</label>
                  <Input
                    id="register-name"
                    type="text"
                    placeholder={t('auth.register.name')}
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    className="bg-card border-input"
                  />
                </div>

                <TabsContent value="fund" className="space-y-2">
                  <label htmlFor="register-fund-name" className="text-sm font-medium text-foreground">{t('auth.register.fundName')}</label>
                  <Input
                    id="register-fund-name"
                    type="text"
                    placeholder={t('auth.register.fundName')}
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="bg-card border-input"
                  />
                </TabsContent>
                <TabsContent value="startup" className="space-y-2">
                  <label htmlFor="register-startup-name" className="text-sm font-medium text-foreground">{t('auth.register.startupName')}</label>
                  <Input
                    id="register-startup-name"
                    type="text"
                    required
                    placeholder={t('auth.register.startupName')}
                    value={form.companyName}
                    onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                    className="bg-card border-input"
                  />
                  {!inviteToken && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      <Link to="/register" className="text-primary underline-offset-4 hover:underline">
                        {t('auth.register.inviteHint')}
                      </Link>
                    </p>
                  )}
                </TabsContent>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('auth.register.submitting') : t('auth.register.submit')}
                </Button>

                <Separator className="my-2" />
                <div className="text-center text-sm">
                  <Button variant="link" asChild>
                    <Link to="/login">{t('auth.register.haveAccount')}</Link>
                  </Button>
                </div>
              </form>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
