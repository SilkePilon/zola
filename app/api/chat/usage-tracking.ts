import type { SupabaseClientType } from "@/app/types/api.types"

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
  supabase,
  userId,
  chatId,
  messageId,
  modelId,
  providerId,
  usage,
  pricing,
}: {
  supabase: SupabaseClientType
  userId: string
  chatId: string
  messageId?: number
  modelId: string
  providerId: string
  usage: UsageData
  pricing: ModelPricing
}): Promise<void> {
  // Only track if we have pricing information
  if (!pricing.inputCost && !pricing.outputCost) {
    return
  }

  // Calculate costs in USD
  // Pricing is per 1M tokens, so divide by 1,000,000
  const inputCostUsd = pricing.inputCost
    ? (usage.inputTokens / 1_000_000) * pricing.inputCost
    : null
  const outputCostUsd = pricing.outputCost
    ? (usage.outputTokens / 1_000_000) * pricing.outputCost
    : null

  const totalCostUsd =
    (inputCostUsd ?? 0) + (outputCostUsd ?? 0) || null

  try {
    const { error } = await supabase.from("model_usage").insert({
      user_id: userId,
      chat_id: chatId,
      message_id: messageId,
      model_id: modelId,
      provider_id: providerId,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens,
      input_cost_per_million: pricing.inputCost ?? null,
      output_cost_per_million: pricing.outputCost ?? null,
      input_cost_usd: inputCostUsd,
      output_cost_usd: outputCostUsd,
      total_cost_usd: totalCostUsd,
    })

    if (error) {
      console.error("Error tracking model usage:", error)
      // Don't throw - usage tracking shouldn't break the chat flow
    }

    // Update budget spending if we have a cost
    if (totalCostUsd && totalCostUsd > 0) {
      try {
        const { updateBudgetSpending } = await import("@/lib/budget")
        await updateBudgetSpending(supabase, userId, providerId, totalCostUsd)
      } catch (budgetError) {
        console.error("Error updating budget spending:", budgetError)
        // Don't throw - budget tracking shouldn't break the chat flow
      }
    }
  } catch (err) {
    console.error("Failed to track model usage:", err)
    // Don't throw - usage tracking shouldn't break the chat flow
  }
}
