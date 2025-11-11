import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from "@/app/types/api.types"
import { getAllModels } from "@/lib/models"
import { sanitizeUserInput } from "@/lib/sanitize"
import type { Json } from "@/app/types/database.types"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import { getUserKey, type ProviderWithoutOllama } from "@/lib/user-keys"

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<SupabaseClientType | null> {
  const supabase = await validateUserIdentity(userId, isAuthenticated)
  if (!supabase) return null

  if (!isAuthenticated) {
    throw new Error(
      "Authentication required. Please sign in to use AI models."
    )
  } else {
    const { getCustomModels } = await import("@/lib/models/custom")
    const customModels = await getCustomModels()
    const allModels = await getAllModels(customModels)
    
    const modelConfig = allModels.find((m) => m.uniqueId === model)

    if (!modelConfig) {
      throw new Error(`Model ${model} not found`)
    }

    const provider = modelConfig.providerId

    if (provider !== "ollama") {
      const userApiKey = await getUserKey(
        userId,
        provider as ProviderWithoutOllama
      )
      
      if (!userApiKey) {
        throw new Error(
          `This model requires an API key for ${provider}. Please add your API key in settings.`
        )
      }
    }
  }

  await checkUsageByModel(supabase, userId, model, isAuthenticated)

  return supabase
}

export async function incrementMessageCount({
  supabase,
  userId,
}: {
  supabase: SupabaseClientType
  userId: string
}): Promise<void> {
  if (!supabase) return

  try {
    await incrementUsage(supabase, userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
    // Don't throw error as this shouldn't block the chat
  }
}

export async function logUserMessage({
  supabase,
  userId,
  chatId,
  parts,
  model,
  isAuthenticated,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  if (!supabase) return

  // Derive legacy content for fallback display by concatenating text parts
  const text = Array.isArray(parts)
    ? parts
        .filter((p: any) => p?.type === "text" && typeof (p as any).text === "string")
        .map((p: any) => (p as any).text as string)
        .join("\n\n")
    : ""
  const { error } = await supabase.from("messages").insert({
    chat_id: chatId,
    role: "user",
    content: sanitizeUserInput(text),
    parts: parts as unknown as Json,
    user_id: userId,
    message_group_id,
  });

  if (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  supabase,
  chatId,
  messages,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<void> {
  if (!supabase) return
  try {
    await saveFinalAssistantMessage(
      supabase,
      chatId,
      messages,
      message_group_id,
      model
    )
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
  }
}
