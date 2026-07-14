"use client"

import { SegmentedControl } from "@/components/ui/segmented-control"
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const THEME_SELECTION_ROW_ID = "settings-row-appearance-theme"

type ThemeValue = "system" | "light" | "dark"

export function ThemeSelection() {
  const { theme, setTheme } = useTheme()

  return (
    <SettingsSection title="Theme">
      <SettingsRow id={THEME_SELECTION_ROW_ID} title="Appearance">
        <SegmentedControl<ThemeValue>
          aria-label="Appearance"
          value={(theme as ThemeValue) || "system"}
          onValueChange={setTheme}
          options={[
            { value: "system", label: "System", icon: <DesktopIcon className="size-4" /> },
            { value: "light", label: "Light", icon: <SunIcon className="size-4" /> },
            { value: "dark", label: "Dark", icon: <MoonIcon className="size-4" /> },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
