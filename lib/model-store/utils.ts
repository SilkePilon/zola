import { FREE_MODELS_IDS } from "@/lib/config"
import { ModelConfig } from "@/lib/models/types"

/**
 * Utility function to filter and sort models based on favorites, search, and visibility
 * @param models - All available models
 * @param favoriteModels - Array of favorite model IDs
 * @param searchQuery - Search query to filter by model name
 * @param isModelHidden - Function to check if a model is hidden
 * @returns Filtered and sorted models
 */
export function filterAndSortModels(
  models: ModelConfig[],
  favoriteModels: string[],
  searchQuery: string,
  isModelHidden: (modelId: string) => boolean
): ModelConfig[] {
  return models
    .filter((model) => !isModelHidden(model.uniqueId))
    .filter((model) => {
      // Only show favorited models (if favorites exist, only show those; if none, show nothing)
      if (favoriteModels && favoriteModels.length > 0) {
        return favoriteModels.includes(model.uniqueId)
      }
      // If no favorites, don't show any models
      return false
    })
    .filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      // If user has favorite models, maintain their order
      if (favoriteModels && favoriteModels.length > 0) {
        const aIndex = favoriteModels.indexOf(a.uniqueId)
        const bIndex = favoriteModels.indexOf(b.uniqueId)
        return aIndex - bIndex
      }

      // Fallback to original sorting (free models and custom models first)
      const aIsFree = FREE_MODELS_IDS.includes(a.uniqueId) || a.isCustom
      const bIsFree = FREE_MODELS_IDS.includes(b.uniqueId) || b.isCustom
      return aIsFree === bIsFree ? 0 : aIsFree ? -1 : 1
    })
}
