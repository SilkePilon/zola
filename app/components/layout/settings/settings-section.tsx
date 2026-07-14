import { cn } from "@/lib/utils"

type SettingsSectionProps = {
  id?: string
  title: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  id,
  title,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section id={id} className={cn("mb-8 last:mb-0", className)}>
      <h3 className="text-fg-primary mb-4 text-base font-semibold">{title}</h3>
      <div className="divide-alpha-1 divide-y">{children}</div>
    </section>
  )
}
