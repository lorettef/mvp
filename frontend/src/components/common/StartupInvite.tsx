import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, Link2, CircleCheck } from 'lucide-react'
import { invitesApi } from '../../api/invites'
import { useAuthStore } from '../../store/authStore'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export const StartupInvite = () => {
  const { t } = useTranslation()
  const { user } = useAuthStore()
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const inviteMutation = useMutation({
    mutationFn: () => invitesApi.create(),
    onSuccess: ({ token }) => {
      setInviteLink(`${window.location.origin}/invite/${token}`)
    },
  })

  const handleCreateInvite = () => {
    setInviteLink(null)
    setCopied(false)
    inviteMutation.mutate()
  }

  const handleCopyInvite = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
  }

  if (user?.role !== 'admin') return null

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={handleCreateInvite} disabled={inviteMutation.isPending}>
          <Link2 className="w-4 h-4 mr-2" />
          {inviteMutation.isPending ? t('dashboard.invite.generating') : t('dashboard.invite.title')}
        </Button>
      </div>

      {inviteLink && (
        <Card className="border bg-card/50">
          <CardContent className="p-5 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('dashboard.invite.link')}</p>
              <p className="text-xs text-muted-foreground">{t('dashboard.invite.hint')}</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label={t('dashboard.invite.link')}
                readOnly
                value={inviteLink}
                className="font-mono text-xs"
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleCopyInvite()}>
                {copied ? <CircleCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? t('dashboard.invite.copied') : t('dashboard.invite.copy')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  )
}
