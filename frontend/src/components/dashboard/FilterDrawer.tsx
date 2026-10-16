import { useId, useLayoutEffect, useRef, useState, type ComponentProps, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SlidersHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardFiltersPanel } from './DashboardFiltersPanel'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function FilterDrawer({ active, panelProps }: {
  active: boolean
  panelProps: ComponentProps<typeof DashboardFiltersPanel>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 8, top: 8, maxHeight: 600 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const panel = panelRef.current
      if (!trigger || !panel) return
      const width = Math.min(320, window.innerWidth - 16)
      const left = Math.max(8, Math.min(trigger.left - width, window.innerWidth - width - 8))
      const overlapX = left < trigger.right && left + width > trigger.left
      const above = Math.max(0, trigger.top - 8)
      const below = Math.max(0, window.innerHeight - trigger.bottom - 8)
      const maxHeight = overlapX ? Math.max(above, below) : window.innerHeight - 16
      const top = overlapX
        ? above >= below ? Math.max(8, trigger.top - Math.min(panel.offsetHeight, above) - 8) : trigger.bottom + 8
        : Math.max(8, Math.min(trigger.top, window.innerHeight - panel.offsetHeight - 8))
      setPosition({ left, top, maxHeight })
    }
    update()
    const observer = new ResizeObserver(update)
    if (panelRef.current) observer.observe(panelRef.current)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      if ((event.target as Element).closest('[role="menu"]')) return
      event.preventDefault()
      close()
    }
    if (event.key !== 'Tab') return
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    if (!items.length) return
    if (event.shiftKey && document.activeElement === items[0]) {
      event.preventDefault()
      items[items.length - 1].focus()
    } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
      event.preventDefault()
      items[0].focus()
    }
  }

  return <>
    <Button ref={triggerRef} type="button" size="sm" variant={active ? 'default' : 'outline'}
      className={active ? 'bg-primary text-primary-foreground' : 'bg-card'}
      aria-label={t('dashboard.filters.title')} aria-expanded={open} aria-controls={panelId}
      onClick={() => { if (open) close(); else setOpen(true) }}>
      <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />{t('dashboard.filters.title')}
    </Button>
    {open && createPortal(<div ref={panelRef} id={panelId} role="dialog" aria-label={t('dashboard.filters.panel')}
      onKeyDown={onKeyDown} style={{ left: position.left, top: position.top, maxHeight: position.maxHeight }}
      className="fixed z-50 w-[min(20rem,calc(100vw-1rem))] overflow-y-auto rounded-lg border bg-card p-4 shadow-lg">
      <div className="mb-4 pr-8">
        <h2 className="text-sm font-semibold">{t('dashboard.filters.title')}</h2>
      </div>
      <DashboardFiltersPanel {...panelProps} />
      <Button type="button" variant="ghost" size="icon" className="absolute right-4 top-3 h-7 w-7" aria-label={t('dashboard.filters.close')} onClick={close}>
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>, document.body)}
  </>
}
