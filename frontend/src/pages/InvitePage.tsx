import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { invitesApi } from '@/api/invites'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

type InviteStatus = 'loading' | 'valid' | 'invalid'

export function InvitePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { token } = useParams<{ token: string }>()
  const [status, setStatus] = useState<InviteStatus>('loading')
  const [organizationName, setOrganizationName] = useState<string | null>(null)

  useEffect(() => {
    setOrganizationName(null)

    if (!token) {
      setStatus('invalid')
      return
    }

    const controller = new AbortController()
    setStatus('loading')

    void invitesApi
      .get(token, { signal: controller.signal })
      .then((invite) => {
        if (controller.signal.aborted) return
        setOrganizationName(invite.organizationName)
        setStatus('valid')
      })
      .catch((error: unknown) => {
        if (axios.isCancel(error) || controller.signal.aborted) return
        setStatus('invalid')
      })

    return () => controller.abort()
  }, [token])

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Card className="border bg-card">
          <CardContent className="p-8 pt-8">
            <div className="mb-6 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-blue-600 shadow-lg shadow-primary-500/25">
                <svg className="h-8 w-8 text-white" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                  <path d="M24 4L6 14v12c0 11.05 7.68 21.37 18 24 10.32-2.63 18-12.95 18-24V14L24 4z" stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <path d="M18 22l4 4 8-8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {status === 'loading' && (
              <div className="flex justify-center py-6" role="status" aria-label={t('common.loading')}>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {status === 'valid' && organizationName && token && (
              <div className="space-y-6 text-center">
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold text-foreground">{t('invite.title')}</h1>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {t('invite.invitedTo', { name: organizationName })}
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigate(`/register?invite=${encodeURIComponent(token)}`)}>
                  {t('invite.cta')}
                </Button>
              </div>
            )}

            {status === 'invalid' && (
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-bold text-foreground">{t('invite.title')}</h1>
                <p className="text-sm leading-6 text-muted-foreground">{t('invite.invalid')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
