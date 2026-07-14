"use client"

import { cn } from "@/lib/utils"

type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  icon?: React.ReactNode
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  "aria-label": string
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn(
        "bg-alpha-1 inline-flex h-9 items-stretch gap-0.5 rounded-md p-[2px]",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.icon ? option.label : undefined}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] text-sm transition-colors",
              option.icon ? "aspect-square" : "px-3",
              isActive
                ? "bg-surface-2 text-fg-primary shadow-sm"
                : "text-fg-muted hover:text-fg-primary"
            )}
          >
            {option.icon ?? option.label}
          </button>
        )
      })}
    </div>
  )
}
