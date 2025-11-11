import { FREE_MODELS_IDS } from "@/lib/config"
import { ModelConfig } from "@/lib/models/types"

export function filterAndSortModels(
  models: ModelConfig[],
  favoriteModels: string[],
  searchQuery: string,
  isModelHidden: (modelId: string) => boolean
): ModelConfig[] {
  return models
    .filter((model) => !isModelHidden(model.uniqueId))
    .filter((model) => 
      favoriteModels && favoriteModels.length > 0 
        ? favoriteModels.includes(model.uniqueId) 
        : true
    )
    .filter((model) =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (favoriteModels && favoriteModels.length > 0) {
        return favoriteModels.indexOf(a.uniqueId) - favoriteModels.indexOf(b.uniqueId)
      }

      const aIsFree = FREE_MODELS_IDS.includes(a.uniqueId) || a.isCustom
      const bIsFree = FREE_MODELS_IDS.includes(b.uniqueId) || b.isCustom
      return aIsFree === bIsFree ? 0 : aIsFree ? -1 : 1
    })
}
