import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { getAllModels } from "@/lib/models"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getUserKey } from "@/lib/user-keys"
import { streamText, ToolSet, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { buildMcpTools, type MCPServerConfig } from "@/lib/mcp/tools"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
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

    const supabase = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
    })

    if (supabase) {
      await incrementMessageCount({ supabase, userId })
    }

    const userMessage = messages[messages.length - 1]

    if (supabase && userMessage?.role === "user") {
      await logUserMessage({
        supabase,
        userId,
        chatId,
        parts: userMessage.parts || [],
        model,
        isAuthenticated,
        message_group_id,
      })
    }

    const allModels = await getAllModels()
    // Find all candidates with this model id (could exist under multiple providers)
    const candidates = allModels.filter((m) => m.id === model)

    if (candidates.length === 0 || !candidates.some((c) => c.apiSdk)) {
      throw new Error(`Model ${model} not found`)
    }

    const effectiveSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT

    // Prefer a candidate with an available API key for the user/env
    let selected = candidates[0]!
    let apiKey: string | undefined
    if (isAuthenticated && userId) {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      for (const c of candidates) {
        if (c.providerId === "ollama") {
          selected = c
          apiKey = undefined
          break
        }
        let key = await getEffectiveApiKey(userId, c.providerId as ProviderWithoutOllama)
        // Fallback to user-specific key lookup for unknown providers (e.g., deepseek, deepinfra)
        if (!key) {
          try {
            key = await getUserKey(userId, c.providerId as any)
          } catch {}
        }
        if (key) {
          selected = c
          apiKey = key || undefined
          break
        }
      }
    } else {
      // Unauthenticated: keep first candidate (already sorted by priority)
      selected = candidates[0]!
      apiKey = undefined
    }

    const modelConfig = selected
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

    const modelMessages = convertToModelMessages(messages)

    // Load MCP tools from user's configured servers (or env vars as fallback)
    const enabledMcpServers = mcpServers?.filter(s => s.enabled) || []
    const { tools: mcpTools, close: closeMcp } = await buildMcpTools(enabledMcpServers)

    // Ensure closeMcp is invoked exactly once
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
      const result = streamText({
      model: makeModel(apiKey, { enableSearch }),
      system: effectiveSystemPrompt,
      messages: modelMessages,
      tools: mcpTools as ToolSet,
      stopWhen: stepCountIs(10),

      onFinish: async ({ response, steps }) => {
        if (supabase) {
          const allMessages: import("@/app/types/api.types").Message[] = []
          
          if (steps?.length) {
            for (const step of steps) {
              if (step.response?.messages) {
                allMessages.push(...(step.response.messages as any[]))
              }
            }
          }
          
          if (response.messages?.length) {
            allMessages.push(...(response.messages as any[]))
          }
          
          await storeAssistantMessage({
            supabase,
            chatId,
            messages: allMessages,
            message_group_id,
            model,
          })
        }
        await safeCloseMcp()
      },

      onError: async (error: unknown) => {
        await safeCloseMcp()
        throw error
      }
    })

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return { totalUsage: part.totalUsage }
        }
      },
      onError: (error: unknown) => {
        // Close MCP without blocking (fire and forget)
        safeCloseMcp().catch(e => console.error("Error closing MCP in onError:", e))
        return extractErrorMessage(error)
      },
    });
    } catch (streamError) {
      // Ensure MCP is closed on early failure (e.g., during streamText setup)
      await safeCloseMcp()
      throw streamError
    }
  } catch (err: unknown) {
    console.error("Error in /api/chat:", err)
    const error = err as {
      code?: string
      message?: string
      statusCode?: number
    }

    return createErrorResponse(error)
  }
}
