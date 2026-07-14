"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  CubeIcon,
  GearSixIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react"
import { DollarSign, Server, Database } from "lucide-react"
import {
  searchSettingsIndex,
  type SettingsSearchEntry,
  type TabType,
} from "./settings-search-index"

type NavItem = {
  tab: TabType
  label: string
  icon: React.ReactNode
  supabaseOnly?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Settings",
    items: [
      { tab: "general", label: "General", icon: <GearSixIcon className="size-4" /> },
      { tab: "appearance", label: "Appearance", icon: <PaintBrushIcon className="size-4" /> },
      { tab: "prompts", label: "Prompts", icon: <NotePencilIcon className="size-4" /> },
      { tab: "apikeys", label: "API Keys", icon: <KeyIcon className="size-4" /> },
      { tab: "models", label: "Models", icon: <CubeIcon className="size-4" /> },
      { tab: "usage", label: "Usage & Cost", icon: <Database className="size-4" />, supabaseOnly: true },
      { tab: "budget", label: "Budget", icon: <DollarSign className="size-4" />, supabaseOnly: true },
    ],
  },
  {
    label: "Customize",
    items: [
      { tab: "connections", label: "Connections", icon: <PlugsConnectedIcon className="size-4" /> },
      { tab: "mcp", label: "MCP Servers", icon: <Server className="size-4" /> },
    ],
  },
]

type SettingsSidebarNavProps = {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onResultSelect: (entry: SettingsSearchEntry) => void
  supabaseEnabled: boolean
}

export function SettingsSidebarNav({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchQueryChange,
  onResultSelect,
  supabaseEnabled,
}: SettingsSidebarNavProps) {
  const searchResults = searchSettingsIndex(searchQuery, supabaseEnabled)
  const isSearching = searchQuery.trim().length > 0

  return (
    <nav
      aria-label="Settings"
      className="border-alpha-1 bg-surface-1 flex w-48 shrink-0 flex-col gap-2 border-r"
    >
      <h2 className="sr-only">Settings</h2>
      <div className="shrink-0 px-3 pt-3">
        <div className="bg-fill-field flex h-9 w-full items-center gap-2 rounded px-2">
          <MagnifyingGlassIcon className="text-fg-muted size-4 shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search"
            aria-label="Search settings"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {isSearching ? (
          searchResults.length > 0 ? (
            <ul className="flex flex-col gap-px">
              {searchResults.map((entry) => (
                <li key={entry.rowId}>
                  <button
                    type="button"
                    onClick={() => onResultSelect(entry)}
                    className="hover:bg-fill-ghost-hover flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left"
                  >
                    <span className="text-fg-primary text-sm">{entry.label}</span>
                    <span className="text-fg-muted text-xs">
                      in{" "}
                      {NAV_GROUPS.flatMap((g) => g.items).find(
                        (i) => i.tab === entry.tab
                      )?.label ?? entry.tab}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted px-2 py-1.5 text-sm">No matching settings</p>
          )
        ) : (
          NAV_GROUPS.map((group) => {
            const items = group.items.filter(
              (item) => !item.supabaseOnly || supabaseEnabled
            )
            if (items.length === 0) return null
            return (
              <div key={group.label}>
                <div className="text-fg-muted px-2 pb-1 text-xs">{group.label}</div>
                <ul className="flex flex-col gap-px">
                  {items.map((item) => {
                    const isActive = item.tab === activeTab
                    return (
                      <li key={item.tab}>
                        <button
                          type="button"
                          onClick={() => onTabChange(item.tab)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm transition-colors",
                            isActive
                              ? "bg-alpha-2 text-fg-primary font-medium"
                              : "text-fg-secondary hover:bg-fill-ghost-hover hover:text-fg-primary"
                          )}
                        >
                          <span className="text-fg-secondary shrink-0">{item.icon}</span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </div>
    </nav>
  )
}
