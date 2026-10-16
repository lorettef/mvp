import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy, CircleCheck } from 'lucide-react'
import { invitesApi } from '../../api/invites'
import { usePermissions } from '@/hooks/usePermissions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export const StartupInvite = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
  const { t } = useTranslation()
  const { canInvite } = usePermissions()
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const invitingRef = useRef(false)
  const dialogSessionRef = useRef(0)

  const inviteMutation = useMutation({
    mutationFn: () => invitesApi.create(),
  })

  const handleOpenChange = (nextOpen: boolean) => {
    dialogSessionRef.current += 1
    onOpenChange(nextOpen)
    setInviteLink(null)
    setCopied(false)
    setCopyFailed(false)
  }

  const handleCreateInvite = () => {
    if (invitingRef.current) return
    invitingRef.current = true
    const session = dialogSessionRef.current
    inviteMutation.mutate(undefined, {
      onSuccess: ({ token }) => {
        if (dialogSessionRef.current === session) {
          setInviteLink(`${window.location.origin}/invite/${token}`)
        }
      },
      onSettled: () => {
        invitingRef.current = false
      },
    })
  }

  const handleCopyInvite = async () => {
    if (!inviteLink) return
    const session = dialogSessionRef.current
    setCopied(false)
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(inviteLink)
      if (dialogSessionRef.current === session) setCopied(true)
    } catch {
      if (dialogSessionRef.current === session) setCopyFailed(true)
    }
  }

  if (!canInvite) return null

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent closeLabel={t('common.cancel')}>
          <DialogHeader>
            <DialogTitle>{t('dashboard.invite.title')}</DialogTitle>
            <DialogDescription>{t('dashboard.invite.hint')}</DialogDescription>
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">{t('dashboard.invite.link')}</p>
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
              {copyFailed && <p role="alert" className="text-sm text-destructive">{t('dashboard.invite.copyFailed')}</p>}
            </div>
          ) : (
            <DialogFooter>
              <Button type="button" onClick={handleCreateInvite} disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? t('dashboard.invite.generating') : t('dashboard.invite.createLink')}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
