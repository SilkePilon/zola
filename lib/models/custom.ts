import { ModelConfig } from "./types"
import { createClient } from "../supabase/server"

export async function getCustomModels(): Promise<ModelConfig[]> {
  try {
    const supabase = await createClient()
    if (!supabase) return []
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []
    
    const { data } = await (supabase as any)
      .from("custom_models")
      .select("*")
      .eq("user_id", user.id)
    
    if (!data) return []
    
    return data.map((m: any) => {
      const modelId = m.model_id.includes('/') ? m.model_id.split('/')[1] : m.model_id
      
      return {
        id: modelId,
        name: m.name,
        providerId: m.provider_id,
        uniqueId: `${m.provider_id}:${modelId}`,
        provider: m.provider_id,
        icon: m.provider_id,
        baseProviderId: m.provider_id,
        contextWindow: m.context_window || 128000,
        inputCost: m.input_cost || 0,
        outputCost: m.output_cost || 0,
        vision: m.vision || false,
        tools: m.tools || false,
        reasoning: m.reasoning || false,
        audio: m.audio || false,
        video: m.video || false,
        baseUrl: m.base_url,
        isCustom: true,
        apiSdk: m.base_url 
          ? async (apiKey?: string) => {
              const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible")
              const instance = createOpenAICompatible({
                name: m.provider_id,
                apiKey: apiKey,
                baseURL: m.base_url,
              })
              return instance(modelId)
            }
          : async (apiKey?: string) => {
              const { getRawModelsDevAPI } = await import("../providers/registry")
              const providersData = await getRawModelsDevAPI() as any
              const providerInfo = providersData[m.provider_id]
              
              if (!providerInfo) {
                throw new Error(`Provider ${m.provider_id} not found. Custom models without a base URL must use a known provider.`)
              }
              
              const { createModelSDK } = await import("./sdk")
              return await createModelSDK(
                { id: m.provider_id, npm: providerInfo.npm, api: providerInfo.api },
                modelId,
                apiKey
              )
            },
      }
    })
  } catch (error) {
    console.warn("Failed to load custom models:", error)
    return []
  }
}
