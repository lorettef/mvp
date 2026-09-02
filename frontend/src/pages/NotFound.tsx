import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export const NotFound = () => {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="border bg-card max-w-md w-full">
        <CardContent className="p-8 text-center">
          <h1 className="text-6xl font-bold text-foreground">{t('notFound.title')}</h1>
          <p className="mt-3 text-muted-foreground">{t('notFound.description')}</p>
          <Button asChild className="mt-6">
            <Link to="/">{t('notFound.home')}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
