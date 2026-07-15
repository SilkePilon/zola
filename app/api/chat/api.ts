import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
} from "@/app/types/api.types"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"
import { getAllModels } from "@/lib/models"
import { sanitizeUserInput } from "@/lib/sanitize"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import { getUserKey, type ProviderWithoutOllama } from "@/lib/user-keys"

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<boolean> {
  await validateUserIdentity(userId, isAuthenticated)

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

  await checkUsageByModel(userId, model, isAuthenticated)

  const providerId = model.includes(":") ? model.split(":")[0] : model

  try {
    const { checkBudgetBeforeChat } = await import("@/lib/budget")
    await checkBudgetBeforeChat(userId, providerId)
  } catch (err: any) {
    if (err.name === "BudgetExceededError") {
      const providerText = err.provider ? ` for ${err.provider}` : ""
      err.message = `${err.message}${providerText}. You've spent $${err.spent.toFixed(4)} of your $${err.limit} ${err.budgetType} budget limit.`
      throw err
    }
    console.error("Error checking budget:", err)
  }

  return true
}

export async function incrementMessageCount({
  userId,
}: {
  userId: string
}): Promise<void> {
  try {
    await incrementUsage(userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
  }
}

export async function logUserMessage({
  userId,
  chatId,
  parts,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  const text = Array.isArray(parts)
    ? parts
        .filter(
          (p: any) => p?.type === "text" && typeof p.text === "string"
        )
        .map((p: any) => p.text as string)
        .join("\n\n")
    : ""

  try {
    await db.insert(messages).values({
      chatId,
      role: "user",
      content: sanitizeUserInput(text),
      parts: parts as unknown,
      userId,
      messageGroupId: message_group_id,
    })
  } catch (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  chatId,
  messages: messageList,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<number | undefined> {
  try {
    return await saveFinalAssistantMessage(
      chatId,
      messageList,
      message_group_id,
      model
    )
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
    return undefined
  }
}
