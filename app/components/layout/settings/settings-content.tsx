"use client"

import { Button } from "@/components/ui/button"
import { DrawerClose } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { cn, isDev } from "@/lib/utils"
import {
  CubeIcon,
  GearSixIcon,
  KeyIcon,
  NotePencilIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Server, Database, DollarSign } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ByokSection } from "./apikeys/byok-section"
import { InteractionPreferences } from "./appearance/interaction-preferences"
import { LayoutSettings } from "./appearance/layout-settings"
import { ThemeSelection } from "./appearance/theme-selection"
import { ConnectionsPlaceholder } from "./connections/connections-placeholder"
import { DeveloperTools } from "./connections/developer-tools"
import { OllamaSection } from "./connections/ollama-section"
import { AccountManagement } from "./general/account-management"
import { HistoryManagement } from "./general/history-management"
import { SystemPromptSection } from "./general/system-prompt"
import { UserProfile } from "./general/user-profile"
import { ModelsSettings } from "./models/models-settings"
import { MCPSettings } from "./mcp/mcp-settings"
import { UsageSettings } from "./usage/usage-settings"
import { BudgetSettings } from "./budget/budget-settings"
import { SettingsSection } from "./settings-section"
import { SettingsSidebarNav } from "./settings-sidebar-nav"
import {
  SECTION_IDS,
  type SettingsSearchEntry,
  type TabType,
} from "./settings-search-index"

export type { TabType }

type SettingsContentProps = {
  isDrawer?: boolean
  activeTab?: TabType
}

const MOBILE_TABS: { tab: TabType; label: string; icon: React.ReactNode }[] = [
  { tab: "general", label: "General", icon: <GearSixIcon className="size-4" /> },
  { tab: "appearance", label: "Appearance", icon: <PaintBrushIcon className="size-4" /> },
  { tab: "prompts", label: "Prompts", icon: <NotePencilIcon className="size-4" /> },
  { tab: "apikeys", label: "API Keys", icon: <KeyIcon className="size-4" /> },
  { tab: "models", label: "Models", icon: <CubeIcon className="size-4" /> },
  { tab: "connections", label: "Connections", icon: <PlugsConnectedIcon className="size-4" /> },
  { tab: "mcp", label: "MCP Servers", icon: <Server className="size-4" /> },
  { tab: "usage", label: "Usage & Cost", icon: <Database className="size-4" /> },
  { tab: "budget", label: "Budget", icon: <DollarSign className="size-4" /> },
]

function TabContent({ activeTab }: { activeTab: TabType }) {
  switch (activeTab) {
    case "general":
      return (
        <>
          <UserProfile />
          <AccountManagement />
          <HistoryManagement />
        </>
      )
    case "appearance":
      return (
        <>
          <ThemeSelection />
          <LayoutSettings />
          <InteractionPreferences />
        </>
      )
    case "prompts":
      return <SystemPromptSection />
    case "apikeys":
      return (
        <SettingsSection id={SECTION_IDS.apikeys} title="API Keys">
          <ByokSection />
        </SettingsSection>
      )
    case "models":
      return (
        <SettingsSection id={SECTION_IDS.models} title="Models">
          <ModelsSettings />
        </SettingsSection>
      )
    case "connections":
      return (
        <SettingsSection id={SECTION_IDS.connections} title="Connections">
          {!isDev && <ConnectionsPlaceholder />}
          {isDev && <OllamaSection />}
          {isDev && <DeveloperTools />}
        </SettingsSection>
      )
    case "mcp":
      return (
        <SettingsSection id={SECTION_IDS.mcp} title="MCP Servers">
          <MCPSettings />
        </SettingsSection>
      )
    case "usage":
      return (
        <SettingsSection id={SECTION_IDS.usage} title="Usage & Cost">
          <UsageSettings />
        </SettingsSection>
      )
    case "budget":
      return (
        <SettingsSection id={SECTION_IDS.budget} title="Budget">
          <BudgetSettings />
        </SettingsSection>
      )
    default:
      return null
  }
}

export function SettingsContent({
  isDrawer = false,
  activeTab: initialActiveTab = "general",
}: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    setActiveTab(initialActiveTab)
  }, [initialActiveTab])

  const handleResultSelect = useCallback((entry: SettingsSearchEntry) => {
    setActiveTab(entry.tab)
    setSearchQuery("")
    requestAnimationFrame(() => {
      const el = document.getElementById(entry.rowId)
      if (!el) return
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      el.classList.add("settings-row-highlight")
      window.setTimeout(() => el.classList.remove("settings-row-highlight"), 1200)
    })
  }, [])

  if (isDrawer) {
    return (
      <div className="bg-surface-2 flex w-full flex-col pb-16">
        <div className="border-alpha-1 flex items-center justify-between border-b px-4 pb-2">
          <h2 className="text-fg-primary text-lg font-medium">Settings</h2>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <XIcon className="size-4" />
            </Button>
          </DrawerClose>
        </div>

        <div className="bg-fill-field mx-4 mt-3 flex h-9 items-center gap-2 rounded px-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>

        <div className="my-3 flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto px-4">
          {MOBILE_TABS.map((t) => (
            <button
              key={t.tab}
              type="button"
              onClick={() => setActiveTab(t.tab)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-sm",
                t.tab === activeTab
                  ? "bg-alpha-2 text-fg-primary font-medium"
                  : "text-fg-secondary"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="px-6">
          <TabContent activeTab={activeTab} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 flex min-h-0 w-full flex-1 flex-row">
      <SettingsSidebarNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResultSelect={handleResultSelect}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  )
}
