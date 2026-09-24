import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border bg-card", className)}>
      {(title || description || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            {title ? <h3 className="text-base font-semibold">{title}</h3> : null}
            {description ? (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}
