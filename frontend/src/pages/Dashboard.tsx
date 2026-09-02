import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '../store/authStore'
import { CompaniesDashboard } from './CompaniesDashboard'

export const Dashboard = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role === 'admin' && user.organizationType !== 'startup') {
    return <CompaniesDashboard />
  }

  if (user.companyId) {
    return <Navigate to={`/companies/${user.companyId}`} replace />
  }

  // Аутентифицированный пользователь без companyId (наблюдатель без
  // привязки к компании): редирект на /login создал бы цикл с bootstrap,
  // поэтому показываем явное состояние «нет доступа».
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{t('dashboard.noAccess')}</CardTitle>
          <CardDescription>{t('dashboard.noAccessDesc')}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  )
}
