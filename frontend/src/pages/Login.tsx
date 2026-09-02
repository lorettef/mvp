import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import { analytics } from '../api/analytics'
import { completeLogin } from '../auth/authSession'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

export const Login = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg] = useState(location.state?.message || '')

  const handleDemoLogin = async () => {
    setLoading(true)
    setError('')
    try {
      await authApi.seed()
      const userData = await authApi.me()
      completeLogin(userData)
      analytics.track('demo_activated')
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || t('auth.login.demoError'))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await authApi.login({ email, password })
      const userData = await authApi.me()
      completeLogin(userData)
      navigate('/dashboard')
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || t('auth.login.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4">
      <div className="max-w-md w-full">
        <Card className="border bg-card">
          <CardContent className="p-8 pt-8">
            <div className="flex justify-center mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/25">
                <svg className="w-8 h-8 text-white" viewBox="0 0 48 48" fill="none">
                  <path d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z"
                    stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <path d="M18 22l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h2 className="text-center text-2xl font-bold text-foreground">
              Startup Engine
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {t('auth.login.subtitle')}
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {successMsg && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-600 text-sm">
                  {successMsg}
                </div>
              )}
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-destructive text-sm">
                  {error}
                </div>
              )}
              <Input
                id="email"
                type="email"
                required
                placeholder={t('auth.login.email')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-card border-input"
              />
              <Input
                id="password"
                type="password"
                required
                placeholder={t('auth.login.password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-card border-input"
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('auth.login.submitting') : t('auth.login.submit')}
              </Button>

              <div className="text-center text-sm">
                <Button variant="link" asChild>
                  <Link to="/register">
                    {t('auth.login.noAccount')}
                  </Link>
                </Button>
              </div>

              <div className="flex items-center gap-3 my-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">{t('auth.login.or')}</span>
                <Separator className="flex-1" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={loading}
                onClick={handleDemoLogin}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                {t('auth.login.demo')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
