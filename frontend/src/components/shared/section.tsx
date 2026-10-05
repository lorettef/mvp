import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Section({
  title,
  description,
  actions,
  children,
  className,
  headerClassName,
  contentClassName,
  actionsClassName,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  actionsClassName?: string
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {(title || description || actions) && (
        <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4", headerClassName)}>
          <div className="min-w-0">
            {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className={cn("flex items-center gap-2", actionsClassName)}>{actions}</div> : null}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </section>
  )
}
