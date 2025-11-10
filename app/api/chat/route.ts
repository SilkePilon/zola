import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import { getAllModels } from "@/lib/models"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getUserKey } from "@/lib/user-keys"
import { streamText, ToolSet, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { buildMcpTools } from "@/lib/mcp/tools"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type MCPServerConfig = {
  id: string
  name: string
  description?: string
  enabled: boolean
  transportType: "stdio" | "http" | "sse"
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

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
    } = (await req.json()) as ChatRequest

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

    // Increment message count for successful validation
    if (supabase) {
      await incrementMessageCount({ supabase, userId })
    }

    const userMessage = messages[messages.length - 1] as any

    if (supabase && userMessage?.role === "user") {
      await logUserMessage({
        supabase,
        userId,
        chatId,
        parts: (userMessage.parts || []) as any,
        model,
        isAuthenticated,
        message_group_id,
      });
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

    // Clean messages before converting - remove tool-invocation parts that are display-only
    const cleanedMessages = messages.map((msg) => {
      if (!msg.parts || !Array.isArray(msg.parts)) return msg
      
      const cleanParts = msg.parts.filter((part: any) => {
        // Remove tool-invocation parts (display-only)
        if (part.type === 'tool-invocation') return false
        return true
      })
      
      return {
        ...msg,
        parts: cleanParts.length > 0 ? cleanParts : msg.parts,
      }
    })

    const modelMessages = convertToModelMessages(cleanedMessages as any)

    // Load MCP tools from user's configured servers (or env vars as fallback)
    const enabledMcpServers = mcpServers?.filter(s => s.enabled) || []
    const { tools: mcpTools, close: closeMcp } = await buildMcpTools(enabledMcpServers)

    const result = streamText({
      model: makeModel(apiKey, { enableSearch }),
      system: effectiveSystemPrompt,
      messages: modelMessages,
      tools: mcpTools as ToolSet,
      stopWhen: stepCountIs(10),

      onError: (err: unknown) => {
        console.error("Streaming error occurred:", err)
        // Don't set streamError anymore - let the AI SDK handle it through the stream
      },

      onFinish: async ({ response, usage, steps }) => {
        if (supabase) {
          // In AI SDK v5 with tools, we need to collect all messages including:
          // 1. Intermediate tool-call messages (from steps)
          // 2. Tool result messages (from steps)
          // 3. Final assistant message with text (from response.messages)
          const allMessages: import("@/app/types/api.types").Message[] = []
          
          if (steps && steps.length > 0) {
            // Collect messages from all steps (tool calls and intermediate responses)
            for (const step of steps) {
              if (step.messages) {
                allMessages.push(...(step.messages as any[]))
              }
            }
          }
          
          // Always include response.messages to ensure we get the final assistant message
          // This contains the complete final response with text content
          if (response.messages && response.messages.length > 0) {
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
        // Log usage for debugging (v5 uses different property names)
        if (usage) {
          console.log("Token usage:", {
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            totalTokens: usage.totalTokens,
          })
        }
        try { closeMcp?.() } catch {}
      }
    })

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      sendSources: true,
      messageMetadata: ({ part }) => {
        // Send total usage when generation is finished
        if (part.type === "finish") {
          return { totalUsage: part.totalUsage }
        }
      },
      onError: (error: unknown) => {
        console.error("Error forwarded to client:", error)
        return extractErrorMessage(error)
      },
    });
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
