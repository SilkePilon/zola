import { cn } from "@/lib/utils"

type SettingsRowProps = {
  id?: string
  title: string
  description?: React.ReactNode
  align?: "center" | "start"
  children: React.ReactNode
  className?: string
}

export function SettingsRow({
  id,
  title,
  description,
  align = "center",
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex gap-6 py-4",
        align === "center" ? "items-center justify-between" : "flex-col",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="text-fg-primary text-sm">{title}</div>
        {description && (
          <div className="text-fg-muted text-sm">{description}</div>
        )}
      </div>
      {align === "center" ? (
        <div className="flex shrink-0 items-center">{children}</div>
      ) : (
        children
      )}
    </div>
  )
}
