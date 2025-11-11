/**
 * Dynamic Provider Registry
 * 
 * This module fetches and caches provider metadata from models.dev API.
 * It provides the single source of truth for provider information including:
 * - npm packages to import
 * - environment variable names
 * - base URLs for API endpoints
 * - provider names and documentation
 */

export type ProviderMetadata = {
  id: string
  name: string
  env: string[]
  npm?: string
  api?: string
  doc?: string
  logoUrl?: string
}

type ModelsDevResponse = Record<string, {
  id: string
  env?: string[]
  npm?: string
  api?: string
  name: string
  doc?: string
  models: Record<string, unknown>
}>

// Cache for provider metadata
let providerCache: Map<string, ProviderMetadata> | null = null
let rawApiCache: ModelsDevResponse | null = null
let lastFetchTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

const MODELS_DEV_URL = process.env.MODELS_DEV_URL || "https://models.dev/api.json"
const MODELS_DEV_LOGO = (providerId: string) =>
  `https://models.dev/logos/${encodeURIComponent(providerId)}.svg`

/**
 * Fetch and cache provider metadata from models.dev API
 */
async function fetchProviderMetadata(): Promise<Map<string, ProviderMetadata>> {
  const now = Date.now()
  
  // Return cached data if still valid
  if (providerCache && now - lastFetchTime < CACHE_DURATION) {
    return providerCache
  }

  try {
    const res = await fetch(MODELS_DEV_URL, { next: { revalidate: 300 } })
    if (!res.ok) {
      throw new Error(`models.dev fetch failed: ${res.status}`)
    }
    
    const json = await res.json() as ModelsDevResponse
    const metadata = new Map<string, ProviderMetadata>()

    // Store raw API response for model fetching
    rawApiCache = json

    for (const providerId of Object.keys(json)) {
      const provider = json[providerId]
      if (!provider) continue

      metadata.set(providerId, {
        id: provider.id,
        name: provider.name,
        env: provider.env || [],
        npm: provider.npm,
        api: provider.api,
        doc: provider.doc,
        logoUrl: MODELS_DEV_LOGO(provider.id),
      })
    }

    providerCache = metadata
    lastFetchTime = now
    return metadata
  } catch (error) {
    console.error("Failed to fetch provider metadata:", error)
    // Return empty cache on error
    providerCache = new Map()
    rawApiCache = null
    lastFetchTime = now
    return providerCache
  }
}

/**
 * Get the raw models.dev API response (includes full model data)
 * This is the single source of truth for all provider and model information
 */
export async function getRawModelsDevAPI(): Promise<ModelsDevResponse> {
  // Ensure cache is populated
  await fetchProviderMetadata()
  return rawApiCache || {}
}

/**
 * Get metadata for a specific provider
 */
export async function getProviderMetadata(providerId: string): Promise<ProviderMetadata | null> {
  const metadata = await fetchProviderMetadata()
  return metadata.get(providerId) || null
}

/**
 * Get all available providers
 */
export async function getAllProviders(): Promise<ProviderMetadata[]> {
  const metadata = await fetchProviderMetadata()
  return Array.from(metadata.values())
}

/**
 * Get environment variable names for a provider
 */
export async function getProviderEnvVars(providerId: string): Promise<string[]> {
  const provider = await getProviderMetadata(providerId)
  return provider?.env || []
}

/**
 * Get the primary environment variable for a provider
 * (uses the first env var in the list)
 */
export async function getPrimaryEnvVar(providerId: string): Promise<string | null> {
  const envVars = await getProviderEnvVars(providerId)
  return envVars[0] || null
}

/**
 * Check if a provider has a native Vercel AI SDK package
 */
export async function hasNativeSDK(providerId: string): Promise<boolean> {
  const provider = await getProviderMetadata(providerId)
  return Boolean(provider?.npm && provider.npm.startsWith("@ai-sdk/"))
}

/**
 * Check if a provider is OpenAI-compatible
 */
export async function isOpenAICompatible(providerId: string): Promise<boolean> {
  const provider = await getProviderMetadata(providerId)
  return Boolean(
    provider?.npm === "@ai-sdk/openai-compatible" || 
    (provider?.api && !provider?.npm?.startsWith("@ai-sdk/"))
  )
}

/**
 * Get provider priority for model selection
 * Higher numbers = higher priority
 */
export function getProviderPriority(providerId: string): number {
  // Native providers get highest priority
  const nativePriority: Record<string, number> = {
    openai: 100,
    google: 100,
    anthropic: 100,
    mistral: 100,
    perplexity: 100,
    xai: 100,
  }
  
  if (nativePriority[providerId]) {
    return nativePriority[providerId]
  }
  
  // Local providers get medium-high priority
  if (providerId === "ollama") {
    return 90
  }
  
  // Aggregators get lower priority
  const aggregators = ["openrouter", "github-copilot"]
  if (aggregators.includes(providerId)) {
    return 20
  }
  
  // Default priority for unknown providers
  return 50
}

/**
 * Refresh the provider cache
 */
export function refreshProviderCache(): void {
  providerCache = null
  rawApiCache = null
  lastFetchTime = 0
}

/**
 * Get cached provider data synchronously (returns null if not cached)
 */
export function getCachedProviderMetadata(providerId: string): ProviderMetadata | null {
  return providerCache?.get(providerId) || null
}
