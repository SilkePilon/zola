import { FREE_MODELS_IDS } from "../config"
import { ModelConfig } from "./types"
import { fetchModelsDevModels } from "./remote"

// Dynamic models cache
let dynamicModelsCache: ModelConfig[] | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// // Function to get all models including dynamically detected ones
export async function getAllModels(): Promise<ModelConfig[]> {
  const now = Date.now()

  // Use cache if it's still valid
  if (dynamicModelsCache && now - lastFetchTime < CACHE_DURATION) {
    return dynamicModelsCache
  }

  try {
    // API-only: load from models.dev and use as the single source of truth
    const remote = await fetchModelsDevModels()
    
    // Enhance models with web search capability info (models.dev doesn't provide this)
    const enhanced = remote.map(model => {
      let webSearch = model.webSearch // Keep existing if set
      
      // OpenAI models: GPT-4o series and O-series support web search
      if (model.providerId === 'openai') {
        if (model.id.includes('gpt-4o') || model.id.includes('chatgpt-4o') || model.id.match(/^o[134](-|$)/)) {
          webSearch = true
        }
      }
      
      // Google/Gemini models: Gemini 1.5+ and 2.x support web search
      if (model.providerId === 'google') {
        if (model.id.startsWith('gemini-1.5') || model.id.startsWith('gemini-2')) {
          webSearch = true
        }
      }
      
      // Perplexity Sonar models have built-in web search
      if (model.providerId === 'perplexity' || model.id.includes('sonar')) {
        webSearch = true
      }
      
      // OpenRouter models that support web search (via plugins)
      if (model.providerId === 'openrouter') {
        // GPT models on OpenRouter
        if (model.id.includes('gpt-4') || model.id.includes('o3-') || model.id.includes('o4-')) {
          webSearch = true
        }
        // Gemini models on OpenRouter
        if (model.id.includes('gemini-2') || model.id.includes('gemini-1.5')) {
          webSearch = true
        }
        // Claude models on OpenRouter
        if (model.id.includes('claude')) {
          webSearch = true
        }
        // Perplexity models on OpenRouter
        if (model.id.includes('sonar') || model.id.includes('perplexity')) {
          webSearch = true
        }
        // Grok models on OpenRouter
        if (model.id.includes('grok')) {
          webSearch = true
        }
      }
      
      return {
        ...model,
        webSearch,
      }
    })
    
    // Prefer direct providers over aggregators when duplicates exist
    const providerPriority: Record<string, number> = {
      openai: 100,
      google: 100,
      anthropic: 100,
      mistral: 100,
      perplexity: 100,
      xai: 100,
      ollama: 90,
      // common aggregators/resellers get lower priority
      openrouter: 20,
      "github-copilot": 10,
    }

    dynamicModelsCache = enhanced.sort((a, b) => {
      const pa = providerPriority[a.providerId] ?? 50
      const pb = providerPriority[b.providerId] ?? 50
      if (pa !== pb) return pb - pa
      // Stable tie-break by id then providerId
      if (a.id !== b.id) return a.id.localeCompare(b.id)
      return (a.providerId || "").localeCompare(b.providerId || "")
    })
    lastFetchTime = now
    return dynamicModelsCache
  } catch (error) {
    console.warn("Failed to load remote models from API:", error)
    // On failure, return empty to signal no models available
    return []
  }
}

export async function getModelsWithAccessFlags(): Promise<ModelConfig[]> {
  const models = await getAllModels()

  const freeModels = models
    .filter(
      (model) =>
        FREE_MODELS_IDS.includes(model.id) || model.providerId === "ollama"
    )
    .map((model) => ({
      ...model,
      accessible: true,
    }))

  const proModels = models
    .filter((model) => !freeModels.map((m) => m.id).includes(model.id))
    .map((model) => ({
      ...model,
      accessible: false,
    }))

  return [...freeModels, ...proModels]
}

export async function getModelsForProvider(
  provider: string
): Promise<ModelConfig[]> {
  const models = await getAllModels()

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
  providers: string[]
): Promise<ModelConfig[]> {
  const providerModels = await Promise.all(
    providers.map((provider) => getModelsForProvider(provider))
  )

  const flatProviderModels = providerModels.flat()

  return flatProviderModels
}

// Synchronous function to get model info for simple lookups
export function getModelInfo(modelId: string): ModelConfig | undefined {
  // First check the cache if it exists
  if (dynamicModelsCache) {
    return dynamicModelsCache.find((model) => model.id === modelId)
  }
  // If cache is not ready, no synchronous fallback in API-only mode
  return undefined
}

// Function to refresh the models cache
export function refreshModelsCache(): void {
  dynamicModelsCache = null
  lastFetchTime = 0
}
