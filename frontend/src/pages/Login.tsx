import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { authApi } from '../api/auth'
import { completeLogin } from '../auth/authSession'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { BrandMark } from '@/components/shared/logo'

export const Login = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg] = useState(location.state?.message || '')

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
            <div className="mb-6 flex justify-center">
              <BrandMark className="h-14 w-14 rounded-2xl shadow-lg shadow-primary-500/25" />
            </div>
            <h2 className="text-center text-2xl font-bold text-foreground">
              Startup Engine
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {t('auth.login.subtitle')}
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {successMsg && (
                <div className="rounded-lg border border-success/20 bg-success/10 p-3 text-sm text-success">
                  {successMsg}
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
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
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
