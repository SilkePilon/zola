"use client"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useModel } from "@/lib/model-store/provider"
import { Gear, Key as KeyIcon } from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import ProviderIcon from "@/components/common/provider-icon"
import { Loader2, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

type ProviderItem = { id: string; name: string; logoUrl?: string; count?: number }

const KEY_HINTS: Record<string, { placeholder: string; getKeyUrl: string; defaultKey: string }> = {
  openrouter: {
    placeholder: "sk-or-v1-...",
    getKeyUrl: "https://openrouter.ai/settings/keys",
    defaultKey: "sk-or-v1-............",
  },
  openai: {
    placeholder: "sk-...",
    getKeyUrl: "https://platform.openai.com/api-keys",
    defaultKey: "sk-............",
  },
  mistral: {
    placeholder: "...",
    getKeyUrl: "https://console.mistral.ai/api-keys/",
    defaultKey: "............",
  },
  google: {
    placeholder: "AIza...",
    getKeyUrl: "https://ai.google.dev/gemini-api/docs/api-key",
    defaultKey: "AIza............",
  },
  perplexity: {
    placeholder: "pplx-...",
    getKeyUrl: "https://docs.perplexity.ai/guides/getting-started",
    defaultKey: "pplx-............",
  },
  xai: {
    placeholder: "xai-...",
    getKeyUrl: "https://console.x.ai/",
    defaultKey: "xai-............",
  },
  anthropic: {
    placeholder: "sk-ant-...",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    defaultKey: "sk-ant-............",
  },
}

export function ByokSection() {
  const queryClient = useQueryClient()
  const { userKeyStatus, refreshAll } = useModel()
  const [providerForSettings, setProviderForSettings] = useState<string>("")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [providerToDelete, setProviderToDelete] = useState<string>("")

  // Fetch dynamic providers from API
  const providersQuery = useQuery({
    queryKey: ["providers"],
    queryFn: async (): Promise<ProviderItem[]> => {
      const res = await fetch("/api/providers", { cache: "no-store" })
      if (!res.ok) throw new Error("Failed to load providers")
      const json = await res.json()
      return (json.providers || []) as ProviderItem[]
    },
  })

  const providers = providersQuery.data || []
  const [providerSearch, setProviderSearch] = useState("")

  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers
    const q = providerSearch.toLowerCase()
    return providers.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    )
  }, [providers, providerSearch])

  // Initialize selection to first provider, preferring openrouter/openai if present
  useEffect(() => {
    // No default selection needed; modal opens per-provider via settings icon
  }, [providers])

  const selectedProviderHints = KEY_HINTS[providerForSettings] || {
    placeholder: "",
    getKeyUrl: "#",
    defaultKey: "",
  }

  const getProviderValue = (providerId: string) => {
    const hints = KEY_HINTS[providerId]
    const hasKey = userKeyStatus[providerId as keyof typeof userKeyStatus]
    const fallbackValue = hasKey ? hints?.defaultKey || "" : ""
    return apiKeys[providerId] || fallbackValue
  }

  const saveMutation = useMutation({
    mutationFn: async ({
      provider,
      apiKey,
    }: {
      provider: string
      apiKey: string
    }) => {
      const res = await fetchClient("/api/user-keys", {
        method: "POST",
        body: JSON.stringify({
          provider,
          apiKey,
        }),
      })
      if (!res.ok) throw new Error("Failed to save key")
      return res.json()
    },
    onSuccess: async (response, { provider }) => {
      toast({
        title: "API key saved",
        description: response.isNewKey
          ? `Your ${provider} API key has been saved and models have been added to your favorites.`
          : `Your ${provider} API key has been updated.`,
      })

      // Use refreshAll to ensure models, user key status, and favorites are all in sync after saving a key
      await refreshAll()

      // If new models were added to favorites, refresh the favorite models cache
      if (response.isNewKey) {
        queryClient.invalidateQueries({ queryKey: ["favorite-models"] })
      }

      setApiKeys((prev) => ({
        ...prev,
        [provider]: KEY_HINTS[provider]?.defaultKey || "",
      }))
    },
    onError: (_, { provider }) => {
      toast({
        title: "Failed to save API key",
        description: `Failed to save ${provider} API key. Please try again.`,
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (provider: string) => {
      const res = await fetchClient("/api/user-keys", {
        method: "DELETE",
        body: JSON.stringify({
          provider,
        }),
      })
      if (!res.ok) throw new Error("Failed to delete key")
      return res
    },
    onSuccess: async (_, provider) => {
      toast({
        title: "API key deleted",
        description: `Your ${provider} API key has been deleted.`,
      })
      await refreshAll()
      setApiKeys((prev) => ({ ...prev, [provider]: "" }))
      setDeleteDialogOpen(false)
      setProviderToDelete("")
    },
    onError: (_, provider) => {
      toast({
        title: "Failed to delete API key",
        description: `Failed to delete ${provider} API key. Please try again.`,
      })
      setDeleteDialogOpen(false)
      setProviderToDelete("")
    },
  })

  const handleConfirmDelete = () => {
    if (providerToDelete) {
      deleteMutation.mutate(providerToDelete)
    }
  }

  const handleDeleteClick = (providerId: string) => {
    setProviderToDelete(providerId)
    setDeleteDialogOpen(true)
  }

  const handleSave = (providerId: string) => {
    const value = getProviderValue(providerId)
    saveMutation.mutate({ provider: providerId, apiKey: value })
  }

  return (
    <div>
      <h3 className="relative mb-2 inline-flex text-lg font-medium">
        Model Providers{" "}
        <span className="text-muted-foreground absolute top-0 -right-7 text-xs">
          new
        </span>
      </h3>
      <p className="text-muted-foreground text-sm">
        Add your own API keys to unlock access to models.
      </p>
      <p className="text-muted-foreground text-sm">
        Your keys are stored securely with end-to-end encryption.
      </p>

      {/* Search */}
      <div className="mt-4 mb-3">
        <input
          type="text"
          placeholder="Search providers..."
          value={providerSearch}
          onChange={(e) => setProviderSearch(e.target.value)}
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <div className="space-y-2 pb-6">
        {filteredProviders.map((provider) => (
          <div
            key={provider.id}
            className="border-border flex items-center gap-3 rounded-lg border bg-transparent p-3"
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
                {(provider.count ?? 0) > 0 && (
                  <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
                    {provider.count} {provider.count === 1 ? "model" : "models"}
                  </span>
                )}
              </div>
            </div>
            {userKeyStatus[provider.id] && (
              <button
                type="button"
                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400/30 hover:bg-emerald-500/10 rounded-md border p-1 transition-colors"
                aria-label={`Delete ${provider.name} API key`}
                onClick={() => {
                  setProviderToDelete(provider.id)
                  setDeleteDialogOpen(true)
                }}
                title="Delete API key"
              >
                <KeyIcon className="size-4" />
              </button>
            )}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1 transition-colors"
              aria-label={`Settings for ${provider.name}`}
              onClick={() => {
                setProviderForSettings(provider.id)
                setSettingsOpen(true)
              }}
            >
              <Gear className="size-4" />
            </button>
          </div>
        ))}
        {filteredProviders.length === 0 && (
          <div className="text-muted-foreground py-6 text-center text-sm">
            {providerSearch
              ? `No providers found matching "${providerSearch}"`
              : "No providers available"}
          </div>
        )}
      </div>

      {/* Settings modal per provider */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {(providers.find((p) => p.id === providerForSettings)?.name || providerForSettings) +
                " Settings"}
            </DialogTitle>
            <DialogDescription>
              Manage your API key for this provider.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Label htmlFor={`${providerForSettings}-key`}>
              API Key
            </Label>
            <Input
              id={`${providerForSettings}-key`}
              type="password"
              placeholder={selectedProviderHints.placeholder}
              value={getProviderValue(providerForSettings)}
              onChange={(e) =>
                setApiKeys((prev) => ({
                  ...prev,
                  [providerForSettings]: e.target.value,
                }))
              }
              disabled={saveMutation.isPending}
            />
            <div className="mt-0 flex items-center justify-between">
              <a
                href={selectedProviderHints.getKeyUrl}
                target="_blank"
                className="text-muted-foreground text-xs hover:underline"
              >
                Get API key
              </a>
              <div className="flex gap-2">
                {providerForSettings &&
                  userKeyStatus[
                    providerForSettings as keyof typeof userKeyStatus
                  ] && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteClick(providerForSettings)}
                      disabled={
                        deleteMutation.isPending || saveMutation.isPending
                      }
                    >
                      <Trash2 className="mr-1 size-4" />
                      Delete
                    </Button>
                  )}
                <Button
                  onClick={() => handleSave(providerForSettings)}
                  type="button"
                  size="sm"
                  disabled={
                    saveMutation.isPending || deleteMutation.isPending
                  }
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your {providers.find((p) => p.id === providerToDelete)?.name || providerToDelete} API key?
              This action cannot be undone and you will lose access to{" "}
              {providers.find((p) => p.id === providerToDelete)?.name || providerToDelete} models.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
