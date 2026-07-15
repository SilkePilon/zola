import type { ContentPart, Message } from "@/app/types/api.types"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"

const DEFAULT_STEP = 0

export async function saveFinalAssistantMessage(
  chatId: string,
  messagesInput: Message[],
  message_group_id?: string,
  model?: string
): Promise<number | undefined> {
  const parts: ContentPart[] = []
  const toolMap = new Map<string, ContentPart>()
  const textParts: string[] = []

  for (const msg of messagesInput) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          textParts.push(part.text || "")
          parts.push(part)
        } else if (part.type === "tool-call") {
          const toolCallId = (part as any).toolCallId || ""
          if (!toolCallId) continue

          toolMap.set(toolCallId, {
            type: "tool-invocation",
            toolInvocation: {
              state: "call",
              step: DEFAULT_STEP,
              toolCallId,
              toolName: (part as any).toolName || "",
              args: (part as any).input || (part as any).args || {},
            },
          })
        } else if (part.type === "tool-invocation" && part.toolInvocation) {
          const { toolCallId, state } = part.toolInvocation
          if (!toolCallId) continue

          const existing = toolMap.get(toolCallId)
          if (state === "result" || !existing) {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args:
                  part.toolInvocation?.args ||
                  existing?.toolInvocation?.args ||
                  {},
                result:
                  part.toolInvocation?.result ||
                  existing?.toolInvocation?.result,
              },
            })
          } else if (state === "call") {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args: part.toolInvocation?.args || {},
              },
            })
          }
        } else if (part.type === "reasoning") {
          parts.push({
            type: "reasoning",
            reasoningText: part.text || "",
            details: [
              {
                type: "text",
                text: part.text || "",
              },
            ],
          })
        } else if (part.type === "step-start") {
          parts.push(part)
        }
      }
    } else if (msg.role === "tool" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "tool-result") {
          const toolCallId = (part as any).toolCallId || ""
          const existing = toolMap.get(toolCallId)

          toolMap.set(toolCallId, {
            type: "tool-invocation",
            toolInvocation: {
              state: "result",
              step: DEFAULT_STEP,
              toolCallId,
              toolName:
                existing?.toolInvocation?.toolName ||
                (part as any).toolName ||
                "unknown",
              args:
                existing?.toolInvocation?.args ||
                (part as any).input ||
                (part as any).args ||
                {},
              result: (part as any).result || (part as any).output,
            },
          })
        }
      }
    }
  }

  parts.push(...toolMap.values())

  const finalPlainText = textParts.join("\n\n")

  try {
    const [row] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: finalPlainText || "",
        parts: parts as unknown,
        messageGroupId: message_group_id,
        model,
      })
      .returning({ id: messages.id })

    console.log("Assistant message saved successfully (merged).")
    return row?.id
  } catch (error) {
    console.error("Error saving final assistant message:", error)
    throw new Error(
      `Failed to save assistant message: ${(error as Error).message}`
    )
  }
}
