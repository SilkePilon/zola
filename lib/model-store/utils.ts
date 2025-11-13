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
    .filter((model) => {
      const query = searchQuery.toLowerCase()
      return (
        model.name.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      if (favoriteModels && favoriteModels.length > 0) {
        return favoriteModels.indexOf(a.uniqueId) - favoriteModels.indexOf(b.uniqueId)
      }
      return 0
    })
}
