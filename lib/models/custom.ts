import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { customModels } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { ModelConfig } from "./types"

export async function getCustomModels(): Promise<ModelConfig[]> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return []

    const rows = await db
      .select()
      .from(customModels)
      .where(eq(customModels.userId, session.user.id))

    return rows.map((m) => {
      const modelId = m.modelId.includes("/")
        ? m.modelId.split("/")[1]
        : m.modelId

      return {
        id: modelId,
        name: m.name,
        providerId: m.providerId,
        uniqueId: `${m.providerId}:${modelId}`,
        provider: m.providerId,
        icon: m.providerId,
        baseProviderId: m.providerId,
        contextWindow: m.contextWindow || 128000,
        inputCost: m.inputCost ? Number(m.inputCost) : 0,
        outputCost: m.outputCost ? Number(m.outputCost) : 0,
        vision: m.vision || false,
        tools: m.tools || false,
        reasoning: m.reasoning || false,
        audio: m.audio || false,
        video: m.video || false,
        baseUrl: m.baseUrl ?? undefined,
        isCustom: true,
        apiSdk: m.baseUrl
          ? async (apiKey?: string) => {
              const { createOpenAICompatible } = await import(
                "@ai-sdk/openai-compatible"
              )
              const instance = createOpenAICompatible({
                name: m.providerId,
                apiKey: apiKey,
                baseURL: m.baseUrl!,
              })
              return instance(modelId)
            }
          : async (apiKey?: string) => {
              const { getRawModelsDevAPI } = await import(
                "../providers/registry"
              )
              const providersData = (await getRawModelsDevAPI()) as any
              const providerInfo = providersData[m.providerId]

              if (!providerInfo) {
                throw new Error(
                  `Provider ${m.providerId} not found. Custom models without a base URL must use a known provider.`
                )
              }

              const { createModelSDK } = await import("./sdk")
              return await createModelSDK(
                {
                  id: m.providerId,
                  npm: providerInfo.npm,
                  api: providerInfo.api,
                },
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
