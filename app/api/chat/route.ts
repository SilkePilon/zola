import type { ContentPart } from "@/app/types/api.types"
import { buildMcpTools, type MCPServerConfig } from "@/lib/mcp/tools"
import { getAllModels } from "@/lib/models"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getUserKey } from "@/lib/user-keys"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  ToolSet,
  type UIMessage,
} from "ai"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { trackModelUsage } from "./usage-tracking"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: UIMessage[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  mcpServers?: MCPServerConfig[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      message_group_id,
      mcpServers,
    } = body as ChatRequest

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    const canPersist = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
    })

    if (canPersist) {
      await incrementMessageCount({ userId })
    }

    const userMessage = messages[messages.length - 1]

    if (canPersist && userMessage?.role === "user") {
      await logUserMessage({
        userId,
        chatId,
        parts: (userMessage.parts || []) as unknown as ContentPart[],
        model,
        isAuthenticated,
        message_group_id,
      })
    }

    const { getCustomModels } = await import("@/lib/models/custom")
    const customModels = await getCustomModels()

    const customModelsForCache =
      customModels && customModels.length > 0 ? customModels : undefined

    const globalModels = await getAllModels(undefined)

    const allModels = customModelsForCache
      ? [...globalModels, ...customModelsForCache]
      : globalModels

    const modelConfig = allModels.find((m) => m.uniqueId === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    const effectiveSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT

    let apiKey: string | undefined
    if (isAuthenticated && userId && modelConfig.providerId !== "ollama") {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      let key = await getEffectiveApiKey(
        userId,
        modelConfig.providerId as ProviderWithoutOllama
      )
      if (!key) {
        try {
          key = await getUserKey(userId, modelConfig.providerId as any)
        } catch {}
      }
      apiKey = key || undefined
    }

    const makeModel = modelConfig.apiSdk
    if (!makeModel) {
      throw new Error(`Selected model ${model} is not invokable`)
    }

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400 }
      )
    }

    const modelMessages = await convertToModelMessages(messages)

    const enabledMcpServers = Array.isArray(mcpServers)
      ? mcpServers.filter((s) => s && typeof s === "object" && s.enabled === true)
      : []
    const { tools: mcpTools, close: closeMcp } =
      await buildMcpTools(enabledMcpServers)

    let mcpClosed = false
    const safeCloseMcp = async () => {
      if (mcpClosed || !closeMcp) return
      mcpClosed = true
      try {
        await closeMcp()
      } catch (closeError) {
        console.error("Error closing MCP transports:", closeError)
      }
    }

    try {
      const modelInstance = await makeModel(apiKey, { enableSearch })

      const streamTextOptions: Parameters<typeof streamText>[0] = {
        model: modelInstance,
        system: effectiveSystemPrompt,
        messages: modelMessages,
        stopWhen: stepCountIs(10),
        onFinish: async ({ response, usage }) => {
          try {
            let savedMessageId: number | undefined

            if (canPersist && response.messages?.length) {
              savedMessageId = await storeAssistantMessage({
                chatId,
                messages: response.messages as any[],
                message_group_id,
                model,
              })
            }

            if (canPersist && usage && (usage.inputTokens || usage.outputTokens)) {
              await trackModelUsage({
                userId,
                chatId,
                messageId: savedMessageId,
                modelId: modelConfig.id,
                providerId: modelConfig.providerId,
                usage: {
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                },
                pricing: {
                  inputCost: modelConfig.inputCost,
                  outputCost: modelConfig.outputCost,
                },
              })
            }
          } catch (saveError) {
            console.error("Error in onFinish:", saveError)
          } finally {
            await safeCloseMcp()
          }
        },
        onError: async (error: unknown) => {
          await safeCloseMcp()
          throw error
        },
      }

      if (modelConfig.tools && mcpTools && Object.keys(mcpTools).length > 0) {
        streamTextOptions.tools = mcpTools as ToolSet
      }

      const result = streamText(streamTextOptions)

      return result.toUIMessageStreamResponse({
        sendReasoning: true,
        sendSources: true,
        messageMetadata: ({ part }) => {
          if (part.type === "finish") {
            return { totalUsage: part.totalUsage }
          }
        },
        onError: (error: unknown) => {
          safeCloseMcp().catch((e) =>
            console.error("Error closing MCP in onError:", e)
          )
          return extractErrorMessage(error)
        },
      })
    } catch (streamError) {
      await safeCloseMcp()
      throw streamError
    }
  } catch (err: unknown) {
    const errorName = (err as any)?.name
    if (errorName !== "BudgetExceededError") {
      console.error("Error in /api/chat:", err)
    }

    const error = err as {
      code?: string
      message?: string
      statusCode?: number
      name?: string
    }

    return createErrorResponse(error)
  }
}
