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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/toast"
import { fetchClient } from "@/lib/fetch"
import { useModel } from "@/lib/model-store/provider"
import { cn } from "@/lib/utils"
import { KeyIcon, PlusIcon } from "@phosphor-icons/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"

type ProviderItem = { id: string; name: string; logoUrl?: string }

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
  const [selectedProvider, setSelectedProvider] = useState<string>("")
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

  // Initialize selection to first provider, preferring openrouter/openai if present
  useEffect(() => {
    if (!selectedProvider && providers.length > 0) {
      const preferred =
        providers.find((p) => p.id === "openrouter") ||
        providers.find((p) => p.id === "openai") ||
        providers[0]
      if (preferred) {
        setSelectedProvider(preferred.id)
      }
    }
  }, [providers, selectedProvider])

  const selectedProviderHints = KEY_HINTS[selectedProvider] || {
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

      <div className="mt-4 grid grid-cols-2 gap-3 min-[400px]:grid-cols-3 min-[500px]:grid-cols-4">
        {providers.map((provider) => (
          <button
            key={provider.id}
            type="button"
            onClick={() => setSelectedProvider(provider.id)}
            className={cn(
              "relative flex aspect-square min-w-28 flex-col items-center justify-center gap-2 rounded-lg border p-4",
              selectedProvider === provider.id
                ? "border-primary ring-primary/30 ring-2"
                : "border-border"
            )}
          >
            {userKeyStatus[provider.id] && (
              <span className="bg-secondary absolute top-1 right-1 rounded-sm border-[1px] p-1">
                <KeyIcon className="text-secondary-foreground size-3.5" />
              </span>
            )}
            {provider.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={provider.logoUrl} alt={provider.name} className="size-4" />
            ) : (
              <span className="size-4" />
            )}
            <span className="truncate max-w-28">{provider.name}</span>
          </button>
        ))}
        <button
          key="soon"
          type="button"
          disabled
          className={cn(
            "flex aspect-square min-w-28 flex-col items-center justify-center gap-2 rounded-lg border p-4 opacity-20",
            "border-primary border-dashed"
          )}
        >
          <PlusIcon className="size-4" />
        </button>
      </div>

      <div className="mt-4">
        {selectedProvider && (
          <div className="flex flex-col">
            <Label htmlFor={`${selectedProvider}-key`} className="mb-3">
              {providers.find((p) => p.id === selectedProvider)?.name || selectedProvider} API Key
            </Label>
            <Input
              id={`${selectedProvider}-key`}
              type="password"
              placeholder={selectedProviderHints.placeholder}
              value={getProviderValue(selectedProvider)}
              onChange={(e) =>
                setApiKeys((prev) => ({
                  ...prev,
                  [selectedProvider]: e.target.value,
                }))
              }
              disabled={saveMutation.isPending}
            />
            <div className="mt-0 flex justify-between pl-1">
              <a
                href={selectedProviderHints.getKeyUrl}
                target="_blank"
                className="text-muted-foreground mt-1 text-xs hover:underline"
              >
                Get API key
              </a>
              <div className="flex gap-2">
                {userKeyStatus[
                  selectedProvider as keyof typeof userKeyStatus
                ] && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => handleDeleteClick(selectedProvider)}
                    disabled={
                      deleteMutation.isPending || saveMutation.isPending
                    }
                  >
                    <Trash2 className="mr-1 size-4" />
                    Delete
                  </Button>
                )}
                <Button
                  onClick={() => handleSave(selectedProvider)}
                  type="button"
                  size="sm"
                  className="mt-2"
                  disabled={saveMutation.isPending || deleteMutation.isPending}
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
        )}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete your {providers.find((p) => p.id === providerToDelete)?.name} API key?
              This action cannot be undone and you will lose access to{" "}
              {providers.find((p) => p.id === providerToDelete)?.name} models.
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
