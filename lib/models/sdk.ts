'use server'

/**
 * SDK creation functions - server-side only
 * This file should only be imported in API routes or server components
 */

type RemoteProvider = {
  id: string
  npm?: string
  api?: string
}

/**
 * Create SDK instance for a provider using dynamic imports (server-side only)
 * Uses provider metadata from models.dev API to determine the correct SDK
 */
export async function createModelSDK(
  provider: RemoteProvider,
  modelId: string,
  apiKey?: string
) {
  const effectiveApiKey = apiKey
  const baseURL = provider.api ? provider.api.replace(/\/+$/, "") : undefined

  // Handle native Vercel AI SDK providers
  if (provider.npm?.startsWith("@ai-sdk/")) {
    const sdkName = provider.npm.replace("@ai-sdk/", "")
    
    switch (sdkName) {
      case "openai": {
        const { createOpenAI } = await import("@ai-sdk/openai")
        const instance = createOpenAI({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "mistral": {
        const { createMistral } = await import("@ai-sdk/mistral")
        const instance = createMistral({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "google": {
        const { createGoogleGenerativeAI } = await import("@ai-sdk/google")
        const instance = createGoogleGenerativeAI({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "perplexity": {
        const { createPerplexity } = await import("@ai-sdk/perplexity")
        const instance = createPerplexity({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "anthropic": {
        const { createAnthropic } = await import("@ai-sdk/anthropic")
        const instance = createAnthropic({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "xai": {
        const { createXai } = await import("@ai-sdk/xai")
        const instance = createXai({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "groq": {
        const { createGroq } = await import("@ai-sdk/groq")
        const instance = createGroq({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "cohere": {
        const { createCohere } = await import("@ai-sdk/cohere")
        const instance = createCohere({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "togetherai": {
        const { createTogetherAI } = await import("@ai-sdk/togetherai")
        const instance = createTogetherAI({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "fireworks": {
        const { createFireworks } = await import("@ai-sdk/fireworks")
        const instance = createFireworks({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "deepseek": {
        const { createDeepSeek } = await import("@ai-sdk/deepseek")
        const instance = createDeepSeek({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "cerebras": {
        const { createCerebras } = await import("@ai-sdk/cerebras")
        const instance = createCerebras({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "baseten": {
        const { createBaseten } = await import("@ai-sdk/baseten")
        const instance = createBaseten({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "deepinfra": {
        const { createDeepInfra } = await import("@ai-sdk/deepinfra")
        const instance = createDeepInfra({
          apiKey: effectiveApiKey,
          baseURL,
        })
        return instance(modelId)
      }
      case "vercel": {
        const { vercel } = await import("@ai-sdk/vercel")
        return vercel(modelId)
      }
    }
  }

  // Handle OpenAI-compatible providers
  if (provider.npm === "@ai-sdk/openai-compatible" || provider.api) {
    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible")
    const instance = createOpenAICompatible({
      name: provider.id,
      apiKey: effectiveApiKey,
      baseURL: baseURL || provider.api || "",
    })
    return instance(modelId)
  }

  // No SDK mapping available
  throw new Error(`No SDK mapping for provider ${provider.id} (npm: ${provider.npm})`)
}
