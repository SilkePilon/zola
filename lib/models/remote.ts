import { ModelConfig } from "./types"
import { createOpenAI } from "@ai-sdk/openai"
import { createMistral } from "@ai-sdk/mistral"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createPerplexity } from "@ai-sdk/perplexity"
import { createAnthropic } from "@ai-sdk/anthropic"
import { createXai } from "@ai-sdk/xai"

// Remote source
const MODELS_DEV_URL = process.env.MODELS_DEV_URL || "https://models.dev/api.json"
const MODELS_DEV_LOGO = (providerId: string) =>
  `https://models.dev/logos/${encodeURIComponent(providerId)}.svg`

// Cache
let cache: { data: ModelConfig[]; ts: number } | null = null
const TTL_MS = 5 * 60 * 1000

// Type guards for remote response (partial)
type RemoteModel = {
  id: string
  name: string
  attachment?: boolean
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
  models: Record<string, RemoteModel>
}

export async function fetchModelsDevModels(): Promise<ModelConfig[]> {
  const now = Date.now()
  if (cache && now - cache.ts < TTL_MS) return cache.data

  try {
    const res = await fetch(MODELS_DEV_URL, { next: { revalidate: 300 } as any })
    if (!res.ok) throw new Error(`models.dev fetch failed: ${res.status}`)
    const json = (await res.json()) as Record<string, RemoteProvider>

    const out: ModelConfig[] = []

    for (const providerId of Object.keys(json)) {
      const provider = json[providerId]
      if (!provider?.models) continue

      const logoUrl = MODELS_DEV_LOGO(provider.id)

      for (const modelId of Object.keys(provider.models)) {
        const m = provider.models[modelId]
        const inputModalities = m.modalities?.input || []
        const outputModalities = m.modalities?.output || []

        const vision = inputModalities.includes("image") || outputModalities.includes("image")
        const audio = inputModalities.includes("audio") || outputModalities.includes("audio")
        const video = inputModalities.includes("video") || outputModalities.includes("video")

        const cfg: ModelConfig = {
          id: m.id,
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
          reasoning: Boolean(m.reasoning),
          openSource: Boolean(m.open_weights),
          icon: provider.id,
          logoUrl,
          apiSdk: (apiKey?: string, _opts?: { enableSearch?: boolean }) => {
            // Explicit provider mappings
            switch (provider.id) {
              case "openai": {
                const instance = createOpenAI({
                  apiKey: apiKey || process.env.OPENAI_API_KEY,
                  compatibility: "strict",
                })
                return instance(m.id as any)
              }

              case "mistral": {
                const instance = createMistral({
                  apiKey: apiKey || process.env.MISTRAL_API_KEY,
                })
                return instance(m.id as any)
              }

              case "google": {
                const instance = createGoogleGenerativeAI({
                  apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
                })
                return instance(m.id as any)
              }

              case "perplexity": {
                const instance = createPerplexity({
                  apiKey: apiKey || process.env.PERPLEXITY_API_KEY,
                })
                return instance(m.id as any)
              }

              case "anthropic": {
                const instance = createAnthropic({
                  apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
                })
                return instance(m.id as any)
              }

              case "xai": {
                const instance = createXai({
                  apiKey: apiKey || process.env.XAI_API_KEY,
                })
                return instance(m.id as any)
              }

              case "openrouter": {
                const instance = createOpenAI({
                  apiKey: apiKey || process.env.OPENROUTER_API_KEY,
                  baseURL: "https://openrouter.ai/api/v1",
                  compatibility: "strict",
                })
                return instance(m.id as any)
              }
            }

            // Generic OpenAI-compatible mapping if provider.api is given
            if (provider.npm === "@ai-sdk/openai-compatible" && provider.api) {
              const instance = createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: provider.api,
                compatibility: "strict",
              })
              return instance(m.id as any)
            }

            if (provider.api) {
              const instance = createOpenAI({
                apiKey: apiKey || process.env.OPENAI_API_KEY,
                baseURL: provider.api,
                compatibility: "strict",
              })
              return instance(m.id as any)
            }

            // No mapping available
            throw new Error(`No SDK mapping for provider ${provider.id}`)
          },
        }

        out.push(cfg)
      }
    }

    cache = { data: out, ts: now }
    return out
  } catch (e) {
    console.warn("Failed fetching models.dev models:", e)
    cache = { data: [], ts: now }
    return []
  }
}
