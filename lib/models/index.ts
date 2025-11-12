import { ModelConfig } from "./types"
import { fetchModelsDevModels } from "./remote"
import { getProviderPriority } from "../providers/registry"

// Dynamic models cache
let dynamicModelsCache: ModelConfig[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// // Function to get all models including dynamically detected ones
export async function getAllModels(customModels?: ModelConfig[]): Promise<ModelConfig[]> {
  const now = Date.now()

  // Use cache if it's still valid and no custom models provided
  if (dynamicModelsCache && now - lastFetchTime < CACHE_DURATION && !customModels) {
    return dynamicModelsCache
  }

  try {
    // API-only: load from models.dev and use as the single source of truth
    const remote = await fetchModelsDevModels()
    
    // Combine remote and custom models
    const allModels = [...remote, ...(customModels || [])]
    
    // Sort models by provider priority (uses dynamic registry)
    dynamicModelsCache = allModels.sort((a, b) => {
      const pa = getProviderPriority(a.providerId)
      const pb = getProviderPriority(b.providerId)
      if (pa !== pb) return pb - pa
      // Stable tie-break by id then providerId
      if (a.id !== b.id) return a.id.localeCompare(b.id)
      return (a.providerId || "").localeCompare(b.providerId || "")
    })
    lastFetchTime = now
    return dynamicModelsCache
  } catch (error) {
    // On failure, return empty array and allow retry
    dynamicModelsCache = null
    lastFetchTime = 0
    return []
  }
}

export async function getModelsForProvider(
  provider: string,
  customModels?: ModelConfig[]
): Promise<ModelConfig[]> {
  const models = await getAllModels(customModels)

  const providerModels = models
    .filter((model) => model.providerId === provider)
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  return providerModels
}

// Function to get models based on user's available providers
export async function getModelsForUserProviders(
  providers: string[],
  customModels?: ModelConfig[]
): Promise<ModelConfig[]> {
  const providerModels = await Promise.all(
    providers.map((provider) => getModelsForProvider(provider, customModels))
  )

  const flatProviderModels = providerModels.flat()

  return flatProviderModels
}

// Synchronous function to get model info for simple lookups
export function getModelInfo(uniqueId: string): ModelConfig | undefined {
  // First check the cache if it exists
  if (dynamicModelsCache) {
    return dynamicModelsCache.find((model) => model.uniqueId === uniqueId)
  }
  // If cache is not ready, no synchronous fallback in API-only mode
  return undefined
}

// Function to refresh the models cache
export function refreshModelsCache(): void {
  dynamicModelsCache = null
  lastFetchTime = 0
}
