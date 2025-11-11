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
      return 0
    })
}
