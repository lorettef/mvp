import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { authApi } from '../api/auth'
import { analytics } from '../api/analytics'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"

export const Register = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    companyName: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await authApi.register(form)
      analytics.track('registered')
      navigate('/login', { state: { message: 'Регистрация успешна! Войдите.' } })
    } catch (err: unknown) {
      const axiosErr = err as AxiosError<{ detail?: string }>
      setError(axiosErr.response?.data?.detail || 'Ошибка регистрации')
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
              Регистрация
            </h2>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Начните управлять юнит-экономикой
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-destructive text-sm">
                  {error}
                </div>
              )}
              <Input
                type="email"
                required
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="bg-card border-input"
              />
              <Input
                type="password"
                required
                minLength={8}
                placeholder="Пароль (мин. 8 символов)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="bg-card border-input"
              />
              <Input
                type="text"
                placeholder="Ваше имя"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="bg-card border-input"
              />
              <Input
                type="text"
                placeholder="Название компании"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                className="bg-card border-input"
              />

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Регистрация...' : 'Зарегистрироваться'}
              </Button>

              <div className="text-center text-sm">
                <Button variant="link" asChild>
                  <Link to="/login">
                    Уже есть аккаунт? Войти
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
