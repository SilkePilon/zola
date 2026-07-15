import "server-only"
import { db } from "@/lib/db/client"
import {
  budgetAlerts,
  budgetLimits,
  chatAttachments,
  chats,
  customModels,
  feedback,
  mcpServers,
  messages,
  modelUsage,
  projects,
  userKeys,
  userPreferences,
  users,
} from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"

export async function reassignUserData(
  fromUserId: string,
  toUserId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ userId: toUserId })
      .where(eq(projects.userId, fromUserId))
    await tx
      .update(chats)
      .set({ userId: toUserId })
      .where(eq(chats.userId, fromUserId))
    await tx
      .update(messages)
      .set({ userId: toUserId })
      .where(eq(messages.userId, fromUserId))
    await tx
      .update(chatAttachments)
      .set({ userId: toUserId })
      .where(eq(chatAttachments.userId, fromUserId))
    await tx
      .update(feedback)
      .set({ userId: toUserId })
      .where(eq(feedback.userId, fromUserId))
    // user_keys has a composite primary key (user_id, provider) — if the
    // target user already has a key for the same provider, reassigning
    // would violate the PK. Drop the anonymous user's row for that
    // provider instead of clobbering the target's existing key.
    const fromUserKeys = await tx.query.userKeys.findMany({
      where: eq(userKeys.userId, fromUserId),
    })
    for (const key of fromUserKeys) {
      const existingTargetKey = await tx.query.userKeys.findFirst({
        where: and(
          eq(userKeys.userId, toUserId),
          eq(userKeys.provider, key.provider)
        ),
      })
      if (existingTargetKey) {
        await tx
          .delete(userKeys)
          .where(
            and(
              eq(userKeys.userId, fromUserId),
              eq(userKeys.provider, key.provider)
            )
          )
      } else {
        await tx
          .update(userKeys)
          .set({ userId: toUserId })
          .where(
            and(
              eq(userKeys.userId, fromUserId),
              eq(userKeys.provider, key.provider)
            )
          )
      }
    }
    await tx
      .update(mcpServers)
      .set({ userId: toUserId })
      .where(eq(mcpServers.userId, fromUserId))
    // custom_models has a unique index on (user_id, provider_id, model_id)
    // — same collision risk as user_keys above.
    const fromCustomModels = await tx.query.customModels.findMany({
      where: eq(customModels.userId, fromUserId),
    })
    for (const model of fromCustomModels) {
      const existingTargetModel = await tx.query.customModels.findFirst({
        where: and(
          eq(customModels.userId, toUserId),
          eq(customModels.providerId, model.providerId),
          eq(customModels.modelId, model.modelId)
        ),
      })
      if (existingTargetModel) {
        await tx.delete(customModels).where(eq(customModels.id, model.id))
      } else {
        await tx
          .update(customModels)
          .set({ userId: toUserId })
          .where(eq(customModels.id, model.id))
      }
    }
    await tx
      .update(modelUsage)
      .set({ userId: toUserId })
      .where(eq(modelUsage.userId, fromUserId))
    // budget_limits has a unique index on (user_id, provider_id). Postgres
    // treats NULL provider_id as distinct across rows, so only non-null
    // provider_id values can actually collide, but handle both the same way.
    const fromBudgetLimits = await tx.query.budgetLimits.findMany({
      where: eq(budgetLimits.userId, fromUserId),
    })
    for (const limit of fromBudgetLimits) {
      const existingTargetLimit =
        limit.providerId === null
          ? undefined
          : await tx.query.budgetLimits.findFirst({
              where: and(
                eq(budgetLimits.userId, toUserId),
                eq(budgetLimits.providerId, limit.providerId)
              ),
            })
      if (existingTargetLimit) {
        await tx.delete(budgetLimits).where(eq(budgetLimits.id, limit.id))
      } else {
        await tx
          .update(budgetLimits)
          .set({ userId: toUserId })
          .where(eq(budgetLimits.id, limit.id))
      }
    }
    await tx
      .update(budgetAlerts)
      .set({ userId: toUserId })
      .where(eq(budgetAlerts.userId, fromUserId))
    // user_preferences has userId as its primary key, so it can't be
    // reassigned if the target user already has a preferences row —
    // delete the anonymous user's row instead in that case.
    const existingTarget = await tx.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, toUserId),
    })
    if (existingTarget) {
      await tx
        .delete(userPreferences)
        .where(eq(userPreferences.userId, fromUserId))
    } else {
      await tx
        .update(userPreferences)
        .set({ userId: toUserId })
        .where(eq(userPreferences.userId, fromUserId))
    }
    await tx.delete(users).where(eq(users.id, fromUserId))
  })
}
