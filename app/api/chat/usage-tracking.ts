import { db } from "@/lib/db/client"
import { modelUsage } from "@/lib/db/schema"

type UsageData = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

type ModelPricing = {
  inputCost?: number
  outputCost?: number
}

/**
 * Track model usage in the database with cost calculation
 * Only tracks if pricing information is available
 */
export async function trackModelUsage({
  userId,
  chatId,
  messageId,
  modelId,
  providerId,
  usage,
  pricing,
}: {
  userId: string
  chatId: string
  messageId?: number
  modelId: string
  providerId: string
  usage: UsageData
  pricing: ModelPricing
}): Promise<void> {
  if (!pricing.inputCost && !pricing.outputCost) {
    return
  }

  const inputCostUsd = pricing.inputCost
    ? (usage.inputTokens / 1_000_000) * pricing.inputCost
    : null
  const outputCostUsd = pricing.outputCost
    ? (usage.outputTokens / 1_000_000) * pricing.outputCost
    : null

  const totalCostUsd = (inputCostUsd ?? 0) + (outputCostUsd ?? 0) || null

  try {
    await db.insert(modelUsage).values({
      userId,
      chatId,
      messageId,
      modelId,
      providerId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      inputCostPerMillion: pricing.inputCost ? String(pricing.inputCost) : null,
      outputCostPerMillion: pricing.outputCost
        ? String(pricing.outputCost)
        : null,
      inputCostUsd: inputCostUsd !== null ? String(inputCostUsd) : null,
      outputCostUsd: outputCostUsd !== null ? String(outputCostUsd) : null,
      totalCostUsd: totalCostUsd !== null ? String(totalCostUsd) : null,
    })

    if (totalCostUsd && totalCostUsd > 0) {
      try {
        const { updateBudgetSpending } = await import("@/lib/budget")
        await updateBudgetSpending(userId, providerId, totalCostUsd)
      } catch (budgetError) {
        console.error("Error updating budget spending:", budgetError)
      }
    }
  } catch (err) {
    console.error("Failed to track model usage:", err)
  }
}
