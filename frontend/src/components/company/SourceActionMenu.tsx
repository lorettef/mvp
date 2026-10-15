import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

/** The caller binds both actions to one exact persisted source, never a matrix row. */
export function SourceActionMenu({ label, onEdit, onDelete, busy, source = false }: {
  label: string; onEdit: () => void; onDelete?: () => void; busy?: boolean; source?: boolean | 'record'
}) {
  const { t } = useTranslation()
  const selected = useRef(false)
  return <DropdownMenu modal={false} onOpenChange={open => { if (open) selected.current = false }}>
    <DropdownMenuTrigger asChild disabled={busy}>
      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={busy}
        aria-label={t('company.sourceActions.label', { source: label })}>
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent onCloseAutoFocus={event => { if (selected.current) event.preventDefault() }} align="end" className="max-w-[calc(100vw-2rem)]">
      <DropdownMenuLabel className="max-w-64 whitespace-normal">{label}</DropdownMenuLabel>
      <DropdownMenuItem disabled={busy} onSelect={() => { selected.current = true; onEdit() }}><Pencil aria-hidden="true" />{t(source === 'record' ? 'company.sourceActions.editRecord' : source ? 'company.sourceActions.editSource' : 'company.sourceActions.edit')}</DropdownMenuItem>
      {onDelete && <DropdownMenuItem disabled={busy} className="text-destructive focus:text-destructive" onSelect={() => { selected.current = true; onDelete() }}>
        <Trash2 aria-hidden="true" />{t(source === 'record' ? 'company.sourceActions.deleteRecord' : source ? 'company.sourceActions.deleteSource' : 'common.delete')}
      </DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>
}
