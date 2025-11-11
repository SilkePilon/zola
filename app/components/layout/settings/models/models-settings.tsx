"use client"

import { useModel } from "@/lib/model-store/provider"
import { ModelConfig } from "@/lib/models/types"
import ProviderIcon from "@/components/common/provider-icon"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import {
  DotsSixVerticalIcon,
  MinusIcon,
  PlusIcon,
  StarIcon,
} from "@phosphor-icons/react"
import { Pencil, Trash2 } from "lucide-react"
import { AnimatePresence, motion, Reorder } from "framer-motion"
import { useMemo, useState } from "react"
import { useFavoriteModels } from "./use-favorite-models"
import { AddCustomModelDialog } from "./add-custom-model-dialog"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { fetchClient } from "@/lib/fetch"
import { toast } from "sonner"

type FavoriteModelItem = ModelConfig & {
  isFavorite: boolean
}

type CustomModel = {
  id: string
  user_id: string
  name: string
  model_id: string
  provider_id: string
  base_url: string | null
  context_window: number | null
  input_cost: number | null
  output_cost: number | null
  vision: boolean
  tools: boolean
  reasoning: boolean
  audio: boolean
  video: boolean
  created_at: string
  updated_at: string
}

export function ModelsSettings() {
  const { models } = useModel()
  const { isModelHidden } = useUserPreferences()
  const [searchQuery, setSearchQuery] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null)
  const queryClient = useQueryClient()

  // Use TanStack Query for favorite models with optimistic updates
  const {
    favoriteModels: currentFavoriteModels,
    updateFavoriteModels,
    updateFavoriteModelsDebounced,
  } = useFavoriteModels()

  const customModelsQuery = useQuery({
    queryKey: ["custom-models"],
    queryFn: async (): Promise<CustomModel[]> => {
      const res = await fetchClient("/api/custom-models")
      if (!res.ok) throw new Error("Failed to load custom models")
      const json = await res.json()
      return json.customModels || []
    },
  })

  const deleteCustomModelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetchClient(`/api/custom-models?id=${id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete custom model")
      return res.json()
    },
    onSuccess: () => {
      toast.success("Custom model deleted")
      queryClient.invalidateQueries({ queryKey: ["custom-models"] })
    },
    onError: (error) => {
      toast.error(
        `Failed to delete custom model: ${error instanceof Error ? error.message : "Please try again."}`
      )
    },
  })

  const customModels = customModelsQuery.data || []

  const getCustomModelUniqueId = (model: CustomModel) => {
    const modelId = model.model_id.includes('/') 
      ? model.model_id.split('/')[1] 
      : model.model_id
    return `${model.provider_id}:${modelId}`
  }

  const favoriteModels: FavoriteModelItem[] = useMemo(() => {
    if (!currentFavoriteModels || !Array.isArray(currentFavoriteModels)) {
      return []
    }

    return currentFavoriteModels
      .map((id: string) => {
        const model = models.find((m) => m.uniqueId === id)
        if (!model || isModelHidden(model.uniqueId) || model.accessible === false) return null
        return { ...model, isFavorite: true }
      })
      .filter(Boolean) as FavoriteModelItem[]
  }, [currentFavoriteModels, models, isModelHidden])

  const availableModelsByProvider = useMemo(() => {
    if (!currentFavoriteModels || !Array.isArray(currentFavoriteModels)) {
      return {}
    }

    const availableModels = models
      .filter(
        (model) =>
          !currentFavoriteModels.includes(model.uniqueId) && 
          !isModelHidden(model.uniqueId) &&
          model.accessible !== false
      )
      .filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
      )

    return availableModels.reduce(
      (acc, model) => {
        const iconKey = model.icon || "unknown"

        if (!acc[iconKey]) {
          acc[iconKey] = []
        }

        acc[iconKey].push(model)

        return acc
      },
      {} as Record<string, typeof models>
    ) as Record<string, ModelConfig[]>
  }, [models, currentFavoriteModels, isModelHidden, searchQuery])

  // Handle reorder - immediate state update with debounced API call
  const handleReorder = (newOrder: FavoriteModelItem[]) => {
    const newOrderIds = newOrder.map((item) => item.uniqueId)
    updateFavoriteModelsDebounced(newOrderIds)
  }

  const toggleFavorite = (modelId: string) => {
    if (!currentFavoriteModels || !Array.isArray(currentFavoriteModels)) return

    const isCurrentlyFavorite = currentFavoriteModels.includes(modelId)
    const newIds = isCurrentlyFavorite
      ? currentFavoriteModels.filter((id: string) => id !== modelId)
      : [...currentFavoriteModels, modelId]

    updateFavoriteModels(newIds)
  }

  const removeFavorite = (modelId: string) => {
    if (!currentFavoriteModels || !Array.isArray(currentFavoriteModels)) return
    updateFavoriteModels(currentFavoriteModels.filter((id: string) => id !== modelId))
  }

  const getProviderIconId = (model: ModelConfig) => model.icon || model.baseProviderId

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-medium">Models</h3>
        <p className="text-muted-foreground mb-4 text-sm">
          Reorder and manage the models shown in your selector.
        </p>
      </div>

      {/* Favorite Models - Drag and Drop List */}
      <div>
        <h4 className="mb-3 text-sm font-medium">
          Your favorites ({favoriteModels.length})
        </h4>
        <AnimatePresence initial={false}>
          {favoriteModels.length > 0 ? (
            <Reorder.Group
              axis="y"
              values={favoriteModels}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {favoriteModels.map((model) => {
                const providerId = getProviderIconId(model)
                // Use unique key: providerId/modelId to handle same model from different providers
                const uniqueKey = `${model.providerId}/${model.id}`

                return (
                  <Reorder.Item key={uniqueKey} value={model} className="group">
                    <div className="border-border flex items-center gap-3 rounded-lg border bg-transparent p-3">
                      {/* Drag Handle */}
                      <div className="text-muted-foreground cursor-grab opacity-60 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
                        <DotsSixVerticalIcon className="size-4" />
                      </div>

                      {/* Provider Icon */}
                      <ProviderIcon
                        providerId={providerId}
                        logoUrl={model.logoUrl}
                        className="size-5 shrink-0"
                        title={model.provider}
                      />

                      {/* Model Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {model.name}
                          </span>
                          <div className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                            {model.provider}
                          </div>
                        </div>
                        {/* API-only: omit description */}
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFavorite(model.uniqueId)}
                        type="button"
                        className="text-muted-foreground hover:text-foreground rounded-md border p-1 opacity-0 transition-all group-hover:opacity-100"
                        title="Remove from favorites"
                      >
                        <MinusIcon className="size-4" />
                      </button>
                    </div>
                  </Reorder.Item>
                )
              })}
            </Reorder.Group>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-border text-muted-foreground flex h-32 items-center justify-center rounded-lg border-2 border-dashed"
            >
              <div className="text-center">
                <StarIcon className="mx-auto mb-2 size-8 opacity-50" />
                <p className="text-sm">No favorite models yet</p>
                <p className="text-xs">Add models from the list below</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Custom Models */}
      <div>
        <h4 className="mb-3 text-sm font-medium">
          Custom models ({customModels.length})
        </h4>
        <AnimatePresence mode="wait">
          {customModels.length > 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {customModels.map((model) => (
                <div
                  key={model.id}
                  className="border-border group flex items-center gap-3 rounded-lg border p-3"
                >
                  <ProviderIcon
                    providerId={model.provider_id}
                    className="size-5 shrink-0"
                    title={model.provider_id}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">
                        {model.name}
                      </span>
                      <div className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                        {model.provider_id}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {model.model_id}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!currentFavoriteModels?.includes(getCustomModelUniqueId(model)) && (
                      <button
                        onClick={() => {
                          if (!currentFavoriteModels || !Array.isArray(currentFavoriteModels)) return
                          updateFavoriteModels([...currentFavoriteModels, getCustomModelUniqueId(model)])
                        }}
                        type="button"
                        className="text-muted-foreground hover:text-foreground rounded-md border p-1 opacity-0 transition-all group-hover:opacity-100"
                        title="Add to favorites"
                      >
                        <PlusIcon className="size-4" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setEditingModel(model)
                        setDialogOpen(true)
                      }}
                      type="button"
                      className="text-muted-foreground hover:text-foreground rounded-md border p-1 opacity-0 transition-all group-hover:opacity-100"
                      title="Edit custom model"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      onClick={() => deleteCustomModelMutation.mutate(model.id)}
                      type="button"
                      className="text-muted-foreground hover:text-foreground rounded-md border p-1 opacity-0 transition-all group-hover:opacity-100"
                      title="Delete custom model"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                onClick={() => setDialogOpen(true)}
                type="button"
                className="text-muted-foreground hover:text-foreground border-border mt-2 flex w-full items-center justify-center gap-2 rounded-md border p-2 transition-colors"
              >
                <PlusIcon className="size-4" />
                <span className="text-sm">Add custom model</span>
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-border text-muted-foreground flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8"
            >
              <div className="text-center">
                <PlusIcon className="mx-auto mb-3 size-8 opacity-50" />
                <p className="text-sm mb-4">No custom models yet</p>
                <button
                  onClick={() => setDialogOpen(true)}
                  type="button"
                  className="text-foreground bg-primary hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                >
                  Add custom model
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AddCustomModelDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingModel(null)
        }}
        editingModel={editingModel}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["custom-models"] })
          setEditingModel(null)
        }}
      />

      {/* Available Models */}
      <div>
        <h4 className="mb-3 text-sm font-medium">Available models</h4>
        <p className="text-muted-foreground mb-4 text-sm">
          Choose models to add to your favorites.
        </p>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search models..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        {/* Models grouped by provider */}
        <div className="space-y-6 pb-6">
          {Object.entries(availableModelsByProvider).map(
            ([iconKey, modelsGroup]) => {
              const firstModel = modelsGroup[0]

              return (
                <div key={iconKey} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <ProviderIcon
                      providerId={firstModel.icon}
                      logoUrl={firstModel.logoUrl}
                      className="size-5"
                      title={firstModel.provider}
                    />
                    <h4 className="font-medium">{firstModel.provider || iconKey}</h4>
                    <span className="text-muted-foreground text-sm">
                      ({modelsGroup.length} models)
                    </span>
                  </div>

                  <div className="space-y-2 pl-7">
                    {modelsGroup.map((model) => {
                      // Use unique key: providerId/modelId to handle same model from different providers
                      const uniqueKey = `${model.providerId}/${model.id}`
                      return (
                        <motion.div
                          key={uniqueKey}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center justify-between py-1"
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{model.name}</span>
                              <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
                                via {model.provider}
                              </span>
                            </div>
                            {/* API-only: omit description */}
                          </div>
                          <button
                            onClick={() => toggleFavorite(model.uniqueId)}
                            type="button"
                            className="text-muted-foreground hover:text-foreground border-border rounded-md border p-1 transition-colors"
                            title="Add to favorites"
                          >
                            <PlusIcon className="size-4" />
                          </button>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )
            }
          )}
        </div>

        {Object.keys(availableModelsByProvider).length === 0 && (
          <div className="text-muted-foreground py-8 text-center text-sm">
            {searchQuery
              ? `No models found matching "${searchQuery}"`
              : "No available models to add"}
          </div>
        )}
      </div>
    </div>
  )
}
