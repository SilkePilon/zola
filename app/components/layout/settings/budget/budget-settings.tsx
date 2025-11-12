"use client"

import * as React from "react"
import { useBudget } from "@/lib/budget-store/provider"
import { useUser } from "@/lib/user-store/provider"
import { useModel } from "@/lib/model-store/provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Gear, Plus as PlusIcon } from "@phosphor-icons/react"
import { Trash2 } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import ProviderIcon from "@/components/common/provider-icon"

type ProviderItem = {
  id: string
  name: string
  logoUrl?: string
}

type ProviderBudget = {
  provider_id: string | null
  provider_name: string
  monthly_budget_usd: string
  daily_budget_usd: string
  per_chat_budget_usd: string
}

export function BudgetSettings() {
  const { user } = useUser()
  const { models } = useModel()
  const {
    budgetLimits,
    isLoading,
    saveBudgetLimits,
    deleteBudgetLimits,
    isSaving,
  } = useBudget()

  // UI State
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  const [selectedProviderId, setSelectedProviderId] = React.useState<string | null>(null)
  const [providerSearch, setProviderSearch] = React.useState("")

  // Derive unique providers from models
  const providers = React.useMemo(() => {
    const providerMap = new Map<string, ProviderItem>()
    for (const model of models) {
      if (!providerMap.has(model.providerId)) {
        providerMap.set(model.providerId, {
          id: model.providerId,
          name: model.provider,
          logoUrl: model.logoUrl,
        })
      }
    }
    return Array.from(providerMap.values())
  }, [models])

  // Filter providers by search
  const filteredProviders = React.useMemo(() => {
    if (!providerSearch) return providers
    const q = providerSearch.toLowerCase()
    return providers.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [providers, providerSearch])

  // Form state for the dialog
  const [monthlyBudget, setMonthlyBudget] = React.useState("")
  const [dailyBudget, setDailyBudget] = React.useState("")
  const [perChatBudget, setPerChatBudget] = React.useState("")
  const [warningThreshold, setWarningThreshold] = React.useState(80)
  const [enforceLimits, setEnforceLimits] = React.useState(true)

  // Get existing budget for a provider
  const getProviderBudget = (providerId: string) => {
    if (!Array.isArray(budgetLimits)) return null
    return budgetLimits.find((b) => b.provider_id === providerId)
  }

  // Check if provider has budget with actual values set
  const hasProviderBudget = (providerId: string) => {
    const budget = getProviderBudget(providerId)
    if (!budget) return false
    // Check if at least one budget field has a value
    return (
      (budget.monthly_budget_usd !== null && budget.monthly_budget_usd !== undefined) ||
      (budget.daily_budget_usd !== null && budget.daily_budget_usd !== undefined) ||
      (budget.per_chat_budget_usd !== null && budget.per_chat_budget_usd !== undefined)
    )
  }

  // Open settings dialog for a provider
  const openSettings = (providerId: string) => {
    setSelectedProviderId(providerId)
    const existingBudget = getProviderBudget(providerId)
    
    if (existingBudget) {
      setMonthlyBudget(existingBudget.monthly_budget_usd?.toString() || "")
      setDailyBudget(existingBudget.daily_budget_usd?.toString() || "")
      setPerChatBudget(existingBudget.per_chat_budget_usd?.toString() || "")
      setWarningThreshold(existingBudget.warning_threshold_percent || 80)
      setEnforceLimits(existingBudget.enforce_limits ?? true)
    } else {
      setMonthlyBudget("")
      setDailyBudget("")
      setPerChatBudget("")
      setWarningThreshold(80)
      setEnforceLimits(true)
    }
    
    setSettingsOpen(true)
  }

  // Save budget for selected provider
  const handleSave = async () => {
    if (!selectedProviderId) return

    try {
      // Check if at least one budget field is set
      const hasAnyBudget =
        monthlyBudget !== "" || dailyBudget !== "" || perChatBudget !== ""

      if (!hasAnyBudget) {
        toast({
          title: "No budgets set",
          description: "Please set at least one budget limit.",
          status: "error",
        })
        return
      }

      // Get all existing budgets except the one being edited
      const otherBudgets = Array.isArray(budgetLimits)
        ? budgetLimits.filter((b) => b.provider_id !== selectedProviderId)
        : []

      // Create new/updated budget
      const newBudget = {
        provider_id: selectedProviderId,
        monthly_budget_usd: monthlyBudget ? parseFloat(monthlyBudget) : null,
        daily_budget_usd: dailyBudget ? parseFloat(dailyBudget) : null,
        per_chat_budget_usd: perChatBudget ? parseFloat(perChatBudget) : null,
        warning_threshold_percent: warningThreshold,
        email_notifications: false,
        enforce_limits: enforceLimits,
      }

      // Save all budgets
      await saveBudgetLimits({
        budgets: [...otherBudgets.map((b) => ({
          provider_id: b.provider_id,
          monthly_budget_usd: b.monthly_budget_usd,
          daily_budget_usd: b.daily_budget_usd,
          per_chat_budget_usd: b.per_chat_budget_usd,
          warning_threshold_percent: b.warning_threshold_percent,
          email_notifications: b.email_notifications,
          enforce_limits: b.enforce_limits,
        })), newBudget],
      } as any)

      toast({
        title: "Budget limits saved",
        description: "Your budget settings have been updated successfully.",
        status: "success",
      })
      
      setSettingsOpen(false)
    } catch (error) {
      console.error("Save error:", error)
      toast({
        title: "Failed to save",
        description: "There was an error saving your budget limits.",
        status: "error",
      })
    }
  }

  // Delete budget for selected provider
  const handleDeleteProvider = async (providerId: string) => {
    if (!providerId) return

    try {
      // Get all budgets except the one being deleted
      const remainingBudgets = Array.isArray(budgetLimits)
        ? budgetLimits.filter((b) => b.provider_id !== providerId)
        : []

      if (remainingBudgets.length === 0) {
        // Delete all budgets
        await deleteBudgetLimits()
      } else {
        // Save remaining budgets
        await saveBudgetLimits({
          budgets: remainingBudgets.map((b) => ({
            provider_id: b.provider_id,
            monthly_budget_usd: b.monthly_budget_usd,
            daily_budget_usd: b.daily_budget_usd,
            per_chat_budget_usd: b.per_chat_budget_usd,
            warning_threshold_percent: b.warning_threshold_percent,
            email_notifications: b.email_notifications,
            enforce_limits: b.enforce_limits,
          })),
        } as any)
      }

      toast({
        title: "Budget removed",
        description: `Budget for ${providers.find((p) => p.id === providerId)?.name} has been removed.`,
        status: "success",
      })
      
      setSettingsOpen(false)
    } catch (error) {
      toast({
        title: "Failed to delete",
        description: "There was an error removing the budget.",
        status: "error",
      })
    }
  }

  const selectedProvider = selectedProviderId
    ? providers.find((p) => p.id === selectedProviderId)
    : null

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium">Budget & Limits</h3>
          <p className="text-muted-foreground text-sm">
            Set spending limits per provider
          </p>
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  return (
    <div>
      <h3 className="mb-2 text-lg font-medium">Budget & Limits</h3>
      <p className="text-muted-foreground mb-1 text-sm">
        Set spending limits for each AI provider.
      </p>

      {/* Search */}
      <div className="mb-3 mt-4">
        <input
          type="text"
          placeholder="Search providers..."
          value={providerSearch}
          onChange={(e) => setProviderSearch(e.target.value)}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      {/* Provider List */}
      <div className="space-y-2 pb-6">
        <AnimatePresence mode="wait">
          {filteredProviders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-muted-foreground py-6 text-center text-sm"
            >
              {providerSearch
                ? `No providers found matching "${providerSearch}"`
                : "No providers available"}
            </motion.div>
          ) : (
            filteredProviders.map((provider) => {
              const hasBudget = hasProviderBudget(provider.id)
              const budget = getProviderBudget(provider.id)
              
              return (
                <motion.div
                  key={provider.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="border-border group flex items-center gap-3 rounded-lg border bg-transparent p-3"
                >
                  <ProviderIcon
                    providerId={provider.id}
                    logoUrl={provider.logoUrl}
                    className="size-5 shrink-0"
                    title={provider.name}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{provider.name}</span>
                      {hasBudget && (
                        <div className="flex gap-1.5">
                          {budget?.monthly_budget_usd !== null && budget?.monthly_budget_usd !== undefined && (
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                              ${budget.monthly_budget_usd}/mo
                            </span>
                          )}
                          {budget?.daily_budget_usd !== null && budget?.daily_budget_usd !== undefined && (
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                              ${budget.daily_budget_usd}/day
                            </span>
                          )}
                          {budget?.per_chat_budget_usd !== null && budget?.per_chat_budget_usd !== undefined && (
                            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                              ${budget.per_chat_budget_usd}/chat
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasBudget && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground rounded-md border p-1 transition-colors"
                        aria-label={`Delete budget for ${provider.name}`}
                        onClick={() => handleDeleteProvider(provider.id)}
                        title="Delete budget"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1 transition-colors"
                      aria-label={`Settings for ${provider.name}`}
                      onClick={() => openSettings(provider.id)}
                    >
                      <Gear className="size-4" />
                    </button>
                  </div>
                </motion.div>
              )
            })
          )}
        </AnimatePresence>
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {selectedProvider?.name || selectedProviderId} Budget Settings
            </DialogTitle>
            <DialogDescription>
              Set spending limits for this provider. Leave empty for no limit.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Budget Inputs */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="monthly-budget" className="text-sm">
                  Monthly Limit ($)
                </Label>
                <Input
                  id="monthly-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="daily-budget" className="text-sm">
                  Daily Limit ($)
                </Label>
                <Input
                  id="daily-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  value={dailyBudget}
                  onChange={(e) => setDailyBudget(e.target.value)}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="per-chat-budget" className="text-sm">
                  Per-Chat Limit ($)
                </Label>
                <Input
                  id="per-chat-budget"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="No limit"
                  value={perChatBudget}
                  onChange={(e) => setPerChatBudget(e.target.value)}
                  className="mt-1.5"
                />
              </div>
            </div>

            {/* Warning Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Warning Threshold</Label>
                <span className="text-muted-foreground text-xs">
                  {warningThreshold}%
                </span>
              </div>
              <Slider
                value={[warningThreshold]}
                onValueChange={([value]) => setWarningThreshold(value)}
                min={50}
                max={95}
                step={5}
                className="w-full"
              />
              <p className="text-muted-foreground text-xs">
                Get warned at this percentage of your budget
              </p>
            </div>

            {/* Enforce Limits */}
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Enforce Limits</Label>
                <p className="text-muted-foreground text-xs">
                  Block usage when limits are reached
                </p>
              </div>
              <Switch
                checked={enforceLimits}
                onCheckedChange={setEnforceLimits}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              {hasProviderBudget(selectedProviderId!) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => selectedProviderId && handleDeleteProvider(selectedProviderId)}
                  disabled={isSaving}
                >
                  <Trash2 className="mr-1 size-4" />
                  Delete
                </Button>
              )}
              <Button
                onClick={handleSave}
                type="button"
                size="sm"
                disabled={isSaving}
                className="ml-auto"
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
