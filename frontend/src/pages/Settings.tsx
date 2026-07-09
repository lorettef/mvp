import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { authApi } from '../api/auth'
import { User, CreditCard, LogOut, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Settings = () => {
  const { user, logout } = useAuthStore()
  const [error, setError] = useState('')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Настройки</h1>

      {/* Профиль */}
      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Профиль
          </h3>
          <div className="space-y-2 text-muted-foreground">
            <p><span className="text-sm text-muted-foreground">Email:</span> {user?.email}</p>
            <p><span className="text-sm text-muted-foreground">Компания:</span> {user?.companyName || 'Не указана'}</p>
            <p><span className="text-sm text-muted-foreground">Имя:</span> {user?.fullName || 'Не указано'}</p>
          </div>
        </CardContent>
      </Card>

      {/* Подписка */}
      <Card className="border">
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Подписка
          </h3>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 'free', label: 'Бесплатный', limit: '1 запрос/день', price: '$0' },
                { id: 'pro', label: 'Pro', limit: '10 запросов/день', price: '$19/мес' },
                { id: 'business', label: 'Business', limit: 'Безлимит', price: '$49/мес' },
              ].map((plan) => (
                <Card
                  key={plan.id}
                  className={`cursor-pointer transition-all duration-200 ${
                    user?.subscriptionPlan === plan.id
                      ? 'border-primary bg-primary/5'
                      : 'border-input bg-card/50'
                  }`}
                >
                  <CardContent className="p-5">
                    <p className="font-semibold text-foreground">{plan.label}</p>
                    <p className="text-sm text-muted-foreground">{plan.limit}</p>
                    <p className="text-sm font-bold text-foreground mt-1">{plan.price}</p>
                    {user?.subscriptionPlan === plan.id ? (
                      <Badge variant="default" className="mt-2">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Активен
                      </Badge>
                    ) : (
                      <button
                        className="text-xs text-muted-foreground mt-2 cursor-not-allowed"
                        disabled
                        title="Contact support to upgrade"
                      >
                        Upgrade
                      </button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-destructive text-sm">
                {error}
              </div>
            )}


            {user && (
              <div className="flex items-center justify-between p-3 bg-card/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Использовано сегодня: {user.usedToday} / {user.dailyLimit}
                  </p>
                </div>
                <div className="w-full max-w-xs bg-muted h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min((user.usedToday / user.dailyLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Выход */}
      <Button
        variant="ghost"
        className="text-destructive hover:text-destructive"
        onClick={logout}
      >
        <LogOut />
        Выйти
      </Button>
    </div>
  )
}
