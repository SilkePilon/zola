import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from "@/app/types/api.types"
import { FREE_MODELS_IDS, NON_AUTH_ALLOWED_MODELS } from "@/lib/config"
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

  // Model now uses uniqueId format: "providerId:modelId"
  // This ensures exact provider matching
  
  // Check if user is authenticated
  if (!isAuthenticated) {
    // For unauthenticated users, only allow specific models by uniqueId
    const isAllowed = NON_AUTH_ALLOWED_MODELS.includes(model)
    if (!isAllowed) {
      throw new Error(
        "This model requires authentication. Please sign in to access more models."
      )
    }
  } else {
    // For authenticated users, check API key requirements
    const { getCustomModels } = await import("@/lib/models/custom")
    const customModels = await getCustomModels()
    const allModels = await getAllModels(customModels)
    
    // Find the model config by uniqueId (providerId:modelId)
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

      // Check if model is in free list by uniqueId or is a custom model
      const isFreeModel = FREE_MODELS_IDS.includes(model) || modelConfig.isCustom
      
      // If no API key and model is not in free list, deny access
      if (!userApiKey && !isFreeModel) {
        throw new Error(
          `This model requires an API key for ${provider}. Please add your API key in settings or use a free model.`
        )
      }
    }
  }

  // Check usage limits for the model
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
