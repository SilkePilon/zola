"use client"

import { Button } from "@/components/ui/button"
import { DrawerClose } from "@/components/ui/drawer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { cn, isDev } from "@/lib/utils"
import {
  CubeIcon,
  Database,
  GearSixIcon,
  KeyIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
  NotePencilIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Server, DollarSign } from "lucide-react"
import { useEffect, useState } from "react"
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

type SettingsContentProps = {
  isDrawer?: boolean
  activeTab?: TabType
}

type TabType = "general" | "appearance" | "prompts" | "models" | "connections" | "mcp" | "usage" | "budget"

export function SettingsContent({
  isDrawer = false,
  activeTab: initialActiveTab = "general",
}: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab)

  useEffect(() => {
    setActiveTab(initialActiveTab)
  }, [initialActiveTab])

  return (
    <div
      className={cn(
        "flex w-full flex-col overflow-y-auto",
        isDrawer ? "p-0 pb-16" : "py-0"
      )}
    >
      {isDrawer && (
        <div className="border-border mb-2 flex items-center justify-between border-b px-4 pb-2">
          <h2 className="text-lg font-medium">Settings</h2>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <XIcon className="size-4" />
            </Button>
          </DrawerClose>
        </div>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabType)}
        className={cn(
          "flex w-full flex-row",
          isDrawer ? "" : "flex min-h-[400px]"
        )}
      >
        {isDrawer ? (
          // Mobile version - tabs on top
          <div className="w-full items-start justify-start overflow-hidden py-4">
            <div>
              <TabsList className="mb-4 flex w-full min-w-0 flex-nowrap items-center justify-start overflow-x-auto bg-transparent px-0">
                <TabsTrigger
                  value="general"
                  className="ml-6 flex shrink-0 items-center gap-2"
                >
                  <GearSixIcon className="size-4" />
                  <span>General</span>
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="flex shrink-0 items-center gap-2"
                >
                  <PaintBrushIcon className="size-4" />
                  <span>Appearance</span>
                </TabsTrigger>
                <TabsTrigger
                  value="prompts"
                  className="flex shrink-0 items-center gap-2"
                >
                  <NotePencilIcon className="size-4" />
                  <span>Prompts</span>
                </TabsTrigger>
                <TabsTrigger
                  value="apikeys"
                  className="flex shrink-0 items-center gap-2"
                >
                  <KeyIcon className="size-4" />
                  <span>API Keys</span>
                </TabsTrigger>
                <TabsTrigger
                  value="models"
                  className="flex shrink-0 items-center gap-2"
                >
                  <CubeIcon className="size-4" />
                  <span>Models</span>
                </TabsTrigger>
                <TabsTrigger
                  value="connections"
                  className="flex shrink-0 items-center gap-2"
                >
                  <PlugsConnectedIcon className="size-4" />
                  <span>Connections</span>
                </TabsTrigger>
                <TabsTrigger
                  value="mcp"
                  className="flex shrink-0 items-center gap-2"
                >
                  <Server className="size-4" />
                  <span>MCP Servers</span>
                </TabsTrigger>
                {isSupabaseEnabled && (
                  <>
                    <TabsTrigger
                      value="usage"
                      className="flex shrink-0 items-center gap-2"
                    >
                      <Database className="size-4" />
                      <span>Usage & Cost</span>
                    </TabsTrigger>
                    <TabsTrigger
                      value="budget"
                      className="mr-6 flex shrink-0 items-center gap-2"
                    >
                      <DollarSign className="size-4" />
                      <span>Budget</span>
                    </TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            {/* Mobile tabs content */}
            <TabsContent value="general" className="space-y-6 px-6">
              <UserProfile />
              {isSupabaseEnabled && (
                <>
                  <AccountManagement />
                  <HistoryManagement />
                </>
              )}
            </TabsContent>

            <TabsContent value="appearance" className="space-y-6 px-6">
              <ThemeSelection />
              <LayoutSettings />
              <InteractionPreferences />
            </TabsContent>

            <TabsContent value="prompts" className="space-y-6 px-6">
              <SystemPromptSection />
            </TabsContent>

            <TabsContent value="apikeys" className="px-6">
              <ByokSection />
            </TabsContent>

            <TabsContent value="models" className="px-6">
              <ModelsSettings />
            </TabsContent>

            <TabsContent value="connections" className="space-y-6 px-6">
              {!isDev && <ConnectionsPlaceholder />}
              {isDev && <OllamaSection />}
              {isDev && <DeveloperTools />}
            </TabsContent>

            <TabsContent value="mcp" className="space-y-6 px-6">
              <MCPSettings />
            </TabsContent>

            {isSupabaseEnabled && (
              <>
                <TabsContent value="usage" className="space-y-6 px-6">
                  <UsageSettings />
                </TabsContent>

                <TabsContent value="budget" className="space-y-6 px-6">
                  <BudgetSettings />
                </TabsContent>
              </>
            )}
          </div>
        ) : (
          // Desktop version - tabs on left
          <>
            <TabsList className="block w-48 rounded-none bg-transparent px-3 pt-4">
              <div className="flex w-full flex-col gap-1">
                <TabsTrigger
                  value="general"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <GearSixIcon className="size-4" />
                    <span>General</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="appearance"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <PaintBrushIcon className="size-4" />
                    <span>Appearance</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="prompts"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <NotePencilIcon className="size-4" />
                    <span>Prompts</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="apikeys"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <KeyIcon className="size-4" />
                    <span>API Keys</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="models"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <CubeIcon className="size-4" />
                    <span>Models</span>
                  </div>
                </TabsTrigger>
                <TabsTrigger
                  value="connections"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <PlugsConnectedIcon className="size-4" />
                    <span>Connections</span>
                  </div>
                </TabsTrigger>

                <TabsTrigger
                  value="mcp"
                  className="w-full justify-start rounded-md px-3 py-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <Server className="size-4" />
                    <span>MCP Servers</span>
                  </div>
                </TabsTrigger>

                {isSupabaseEnabled && (
                  <>
                    <TabsTrigger
                      value="usage"
                      className="w-full justify-start rounded-md px-3 py-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Database className="size-4" />
                        <span>Usage & Cost</span>
                      </div>
                    </TabsTrigger>

                    <TabsTrigger
                      value="budget"
                      className="w-full justify-start rounded-md px-3 py-2 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <DollarSign className="size-4" />
                        <span>Budget</span>
                      </div>
                    </TabsTrigger>
                  </>
                )}
              </div>
            </TabsList>

            {/* Desktop tabs content */}
            <div className="flex-1 overflow-auto px-6 pt-4">
              <TabsContent value="general" className="mt-0 space-y-6">
                <UserProfile />
                {isSupabaseEnabled && (
                  <>
                    <AccountManagement />
                    <HistoryManagement />
                  </>
                )}
              </TabsContent>

              <TabsContent value="appearance" className="mt-0 space-y-6">
                <ThemeSelection />
                <LayoutSettings />
                <InteractionPreferences />
              </TabsContent>

              <TabsContent value="prompts" className="mt-0 space-y-6">
                <SystemPromptSection />
              </TabsContent>

              <TabsContent value="apikeys" className="mt-0 space-y-6">
                <ByokSection />
              </TabsContent>

              <TabsContent value="models" className="mt-0 space-y-6">
                <ModelsSettings />
              </TabsContent>

              <TabsContent value="connections" className="mt-0 space-y-6">
                {!isDev && <ConnectionsPlaceholder />}
                {isDev && <OllamaSection />}
                {isDev && <DeveloperTools />}
              </TabsContent>

              <TabsContent value="mcp" className="mt-0 space-y-6">
                <MCPSettings />
              </TabsContent>

              {isSupabaseEnabled && (
                <>
                  <TabsContent value="usage" className="mt-0 space-y-6">
                    <UsageSettings />
                  </TabsContent>

                  <TabsContent value="budget" className="mt-0 space-y-6">
                    <BudgetSettings />
                  </TabsContent>
                </>
              )}
            </div>
          </>
        )}
      </Tabs>
    </div>
  )
}
