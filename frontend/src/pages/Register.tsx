import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import { analytics } from '../api/analytics'
import { invitesApi } from '../api/invites'
import { completeLogin } from '../auth/authSession'
import { getDefaultRoute } from '@/lib/defaultRoute'
import { normalizeFormApiError, type ApiField } from '@/lib/apiError'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandMark } from '@/components/shared/logo'

type AccountType = 'fund' | 'startup'
type FieldErrors = Partial<Record<ApiField, string>>
const INDUSTRIES = [['saas', 'SaaS'], ['fintech', 'Fintech'], ['ecommerce', 'E-commerce'], ['edtech', 'EdTech'], ['healthtech', 'HealthTech'], ['ai', 'AI/ML'], ['marketplaces', 'Маркетплейсы'], ['foodtech', 'FoodTech'], ['logistics', 'Логистика'], ['proptech', 'PropTech'], ['media', 'Медиа и развлечения'], ['hardware', 'Hardware / IoT'], ['biotech', 'Biotech'], ['cleantech', 'CleanTech'], ['other', 'Другое']] as const
const passwordChecks = (password: string) => ({ length: password.length >= 8 && password.length <= 128, uppercase: /[A-Z]/.test(password), lowercase: /[a-z]/.test(password), digit: /\d/.test(password) })

export const Register = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '', fullName: '', companyName: '', industry: '', geography: '' })
  const [accountType, setAccountType] = useState<AccountType>(inviteToken ? 'startup' : 'fund')
  const [showPassword, setShowPassword] = useState(false)
  const [invite, setInvite] = useState<{ organizationName: string; email: string | null } | null>(null)
  const [inviteState, setInviteState] = useState<'idle' | 'loading' | 'valid' | 'invalid'>(inviteToken ? 'loading' : 'idle')
  const [loading, setLoading] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [generalError, setGeneralError] = useState('')
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!inviteToken) return
    const controller = new AbortController()
    setInviteState('loading')
    void invitesApi.get(inviteToken, { signal: controller.signal }).then((value) => {
      if (controller.signal.aborted) return
      setInvite(value); setInviteState('valid')
      if (value.email) setForm((current) => ({ ...current, email: value.email ?? '' }))
    }).catch((error: unknown) => { if (!axios.isCancel(error) && !controller.signal.aborted) setInviteState('invalid') })
    return () => controller.abort()
  }, [inviteToken])

  const update = (name: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [name]: value }))
    const errorName = name as ApiField
    if (fieldErrors[errorName]) setFieldErrors((current) => ({ ...current, [errorName]: undefined }))
  }
  const focusFirstError = () => requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
  const validate = (): FieldErrors => {
    const errors: FieldErrors = {}
    if (!/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/.test(form.email)) errors.email = t('auth.register.errors.email')
    if (!Object.values(passwordChecks(form.password)).every(Boolean)) errors.password = t('auth.register.errors.password')
    if (form.password !== form.confirmPassword) errors.confirmPassword = t('auth.register.errors.confirmPassword')
    if (!form.fullName.trim()) errors.fullName = t('auth.register.errors.fullName')
    if (!form.companyName.trim()) errors.companyName = accountType === 'startup' ? t('auth.register.startupNameRequired') : t('auth.register.errors.companyName')
    return errors
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading || (inviteToken && inviteState !== 'valid')) return
    setGeneralError('')
    const clientErrors = validate(); setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length) { focusFirstError(); return }
    setLoading(true)
    try {
      await authApi.register({
        email: form.email, password: form.password, full_name: form.fullName, company_name: form.companyName,
        ...(accountType === 'startup' ? { account_type: 'startup' as const } : {}),
        ...(inviteToken ? { invite_token: inviteToken } : {}),
        ...(accountType === 'startup' && form.industry ? { industry: form.industry } : {}),
        ...(accountType === 'startup' && form.geography ? { geography: form.geography } : {}),
      })
      const user = await authApi.me()
      completeLogin(user); analytics.track('registered')
      navigate(getDefaultRoute(user) ?? '/dashboard', { replace: true })
    } catch (error: unknown) {
      const normalized = normalizeFormApiError(error, t('auth.register.error'))
      if (normalized.status === 409 && /email/i.test(normalized.message)) normalized.fieldErrors.email = normalized.message
      setFieldErrors(normalized.fieldErrors)
      if (normalized.status === 429) setGeneralError(t('auth.register.errors.rateLimit', { retryAfter: normalized.retryAfter ? ` ${t('auth.register.errors.retryAfter', { seconds: normalized.retryAfter })}` : '' }))
      else if (normalized.network) setGeneralError(t('auth.register.errors.network'))
      else if (!Object.keys(normalized.fieldErrors).length) setGeneralError(normalized.message)
      focusFirstError()
    } finally { setLoading(false) }
  }

  const field = (name: ApiField, content: ReactNode, hint?: ReactNode) => <div className="space-y-2">{content}{hint}{fieldErrors[name] && <p id={`${name}-error`} role="alert" className="text-sm text-destructive">{fieldErrors[name]}</p>}</div>
  const inputA11y = (name: ApiField) => ({ 'aria-invalid': Boolean(fieldErrors[name]), 'aria-describedby': fieldErrors[name] ? `${name}-error` : undefined })
  const checks = passwordChecks(form.password)

  return <div className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-background px-4 py-8 sm:py-12"><div className="w-full max-w-md"><Card><CardContent className="p-5 pt-7 sm:p-8 sm:pt-8">
    <div className="mb-6 flex justify-center"><BrandMark className="h-14 w-14 rounded-2xl" /></div>
    <h1 className="text-center text-2xl font-bold">{inviteToken ? t('auth.register.inviteTitle') : t('auth.register.title')}</h1><p className="mt-1 text-center text-sm text-muted-foreground">{t('auth.register.subtitle')}</p>
    <Tabs value={accountType} onValueChange={(value) => { if (!inviteToken && (value === 'fund' || value === 'startup')) setAccountType(value) }} className="mt-8">
      {!inviteToken && <TabsList className="grid h-auto w-full grid-cols-2"><TabsTrigger value="fund">{t('auth.register.modeFund')}</TabsTrigger><TabsTrigger value="startup">{t('auth.register.modeStartup')}</TabsTrigger></TabsList>}
      <form ref={formRef} noValidate className="mt-6 space-y-4" aria-label={t('auth.register.title')} aria-busy={loading || inviteState === 'loading'} onSubmit={handleSubmit}>
        {inviteState === 'loading' && <div role="status" className="flex items-center gap-2 rounded-lg border p-3 text-sm"><Loader2 className="h-4 w-4 animate-spin" />{t('auth.register.inviteLoading')}</div>}
        {inviteState === 'invalid' && <div role="alert" className="space-y-3 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"><p>{t('invite.invalid')}</p><Button variant="outline" size="sm" asChild><Link to="/register">{t('auth.register.withoutInvite')}</Link></Button></div>}
        {inviteState === 'valid' && invite && <div role="status" className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">{t('auth.register.inviteBanner', { name: invite.organizationName })}</div>}
        {generalError && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">{generalError}</div>}
        {field('email', <><label htmlFor="register-email" className="text-sm font-medium">{t('auth.register.email')}</label><Input id="register-email" type="email" inputMode="email" autoComplete="email" readOnly={Boolean(invite?.email)} value={form.email} onChange={(e) => update('email', e.target.value)} {...inputA11y('email')} /></>)}
        {field('password', <><label htmlFor="register-password" className="text-sm font-medium">{t('auth.register.password')}</label><div className="relative"><Input id="register-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} value={form.password} onChange={(e) => update('password', e.target.value)} aria-invalid={Boolean(fieldErrors.password)} aria-describedby="password-requirements password-error" className="pr-11" /><button type="button" className="absolute inset-y-0 right-0 flex w-11 items-center justify-center" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? t('auth.register.hidePassword') : t('auth.register.showPassword')}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></>, <ul id="password-requirements" className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">{(['length', 'uppercase', 'lowercase', 'digit'] as const).map((key) => <li key={key} className="flex items-center gap-1.5">{checks[key] ? <Check className="h-3.5 w-3.5 text-success" /> : <X className="h-3.5 w-3.5" />}{t(`auth.register.passwordRules.${key}`)}</li>)}</ul>)}
        {field('confirmPassword', <><label htmlFor="register-confirm-password" className="text-sm font-medium">{t('auth.register.confirmPassword')}</label><Input id="register-confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" maxLength={128} value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} {...inputA11y('confirmPassword')} /></>)}
        {field('fullName', <><label htmlFor="register-name" className="text-sm font-medium">{t('auth.register.name')}</label><Input id="register-name" autoComplete="name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} {...inputA11y('fullName')} /></>)}
        <TabsContent value="fund">{field('companyName', <><label htmlFor="register-fund-name" className="text-sm font-medium">{t('auth.register.fundName')}</label><Input id="register-fund-name" autoComplete="organization" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} {...inputA11y('companyName')} /></>)}</TabsContent>
        <TabsContent value="startup" className="space-y-4">{field('companyName', <><label htmlFor="register-startup-name" className="text-sm font-medium">{t('auth.register.startupName')}</label><Input id="register-startup-name" autoComplete="organization" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} {...inputA11y('companyName')} /></>)}
          <div className="space-y-2"><label htmlFor="register-industry" className="text-sm font-medium">{t('auth.register.industry')}</label><Select value={form.industry} onValueChange={(value) => update('industry', value)}><SelectTrigger id="register-industry" aria-label={t('auth.register.industry')}><SelectValue placeholder={t('auth.register.industryPlaceholder')} /></SelectTrigger><SelectContent>{INDUSTRIES.map(([slug, label]) => <SelectItem key={slug} value={slug}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><label htmlFor="register-geography" className="text-sm font-medium">{t('auth.register.geography')}</label><Select value={form.geography} onValueChange={(value) => update('geography', value)}><SelectTrigger id="register-geography" aria-label={t('auth.register.geography')}><SelectValue placeholder={t('auth.register.geographyPlaceholder')} /></SelectTrigger><SelectContent>{['ru', 'kz', 'global'].map((geo) => <SelectItem key={geo} value={t(`common.geo.${geo}`)}>{t(`common.geo.${geo}`)}</SelectItem>)}</SelectContent></Select></div>
        </TabsContent>
        <Button type="submit" className="w-full" disabled={loading || (Boolean(inviteToken) && inviteState !== 'valid')}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{loading ? t('auth.register.submitting') : t('auth.register.submit')}</Button>
        {fieldErrors.email?.includes('существует') && <p className="text-center text-sm"><Link className="text-primary underline" to="/login">{t('auth.register.signIn')}</Link></p>}
        <Separator /><div className="text-center text-sm"><Button variant="link" asChild><Link to="/login">{t('auth.register.haveAccount')}</Link></Button></div>
      </form>
    </Tabs>
  </CardContent></Card></div></div>
}
