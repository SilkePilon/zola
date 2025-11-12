import { ModelConfig } from "./types"
import { getRawModelsDevAPI } from "../providers/registry"

// Cache - Note: Provider registry handles the actual API caching
let cache: { data: ModelConfig[]; ts: number } | null = null
const TTL_MS = 5 * 60 * 1000

// Type guards for remote response (partial)
type RemoteModel = {
  id: string
  name: string
  attachment?: boolean
  reasoningText?: boolean
  reasoning?: boolean
  temperature?: boolean
  tool_call?: boolean
  knowledge?: string
  release_date?: string
  last_updated?: string
  modalities?: { input?: string[]; output?: string[] }
  open_weights?: boolean
  cost?: { input?: number; output?: number; cache_read?: number }
  limit?: { context?: number; output?: number }
}

type RemoteProvider = {
  id: string
  env?: string[]
  npm?: string // e.g. "@ai-sdk/openai-compatible"
  api?: string // base URL for API
  name: string
  doc?: string
  logoUrl?: string
  models: Record<string, RemoteModel>
}

export async function fetchModelsDevModels(): Promise<ModelConfig[]> {
  const now = Date.now()
  if (cache && now - cache.ts < TTL_MS) return cache.data

  try {
    // Use the provider registry to get full API data (single source of truth)
    const json = (await getRawModelsDevAPI()) as Record<string, RemoteProvider>

    const out: ModelConfig[] = []

    for (const providerId of Object.keys(json)) {
      const provider = json[providerId]
      if (!provider?.models) continue

      const logoUrl = provider.logoUrl || `https://models.dev/logos/${encodeURIComponent(provider.id)}.svg`

      for (const modelId of Object.keys(provider.models)) {
        const m = provider.models[modelId]
        const inputModalities = m.modalities?.input || []
        const outputModalities = m.modalities?.output || []

        const vision = inputModalities.includes("image") || outputModalities.includes("image")
        const audio = inputModalities.includes("audio") || outputModalities.includes("audio")
        const video = inputModalities.includes("video") || outputModalities.includes("video")

        const cfg: ModelConfig = {
          id: m.id,
          uniqueId: `${provider.id}:${m.id}`,
          name: m.name,
          provider: provider.name,
          providerId: provider.id,
          baseProviderId: provider.id,
          updatedAt: m.last_updated || m.release_date,
          // Minimal API-only shape: only include optional fields if present
          contextWindow: m.limit?.context,
          inputCost: m.cost?.input,
          outputCost: m.cost?.output,
          priceUnit: m.cost ? "per 1M tokens" : undefined,
          vision,
          tools: Boolean(m.tool_call),
          audio,
          video,
          // Support both legacy and newer reasoning flags
          reasoningText: Boolean(m.reasoningText),
          reasoning: Boolean(m.reasoning ?? m.reasoningText),
          openSource: Boolean(m.open_weights),
          icon: provider.id,
          logoUrl,
          apiSdk: async (apiKey?: string, _opts?: { enableSearch?: boolean }) => {
            // Lazy load SDK creation to avoid bundling AI SDK packages on client
            const { createModelSDK } = await import("./sdk")
            return await createModelSDK(provider, m.id, apiKey)
          },
        }

        out.push(cfg)
      }
    }

    cache = { data: out, ts: now }
    return out
  } catch (e) {
    // Silent fallback: return empty array and reset cache for retry
    cache = { data: [], ts: now }
    return []
  }
}
