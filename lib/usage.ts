import "server-only"
import { UsageLimitError } from "@/lib/api"
import {
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "@/lib/config"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function checkUsage(userId: string) {
  const [userData] = await db
    .select({
      messageCount: users.messageCount,
      dailyMessageCount: users.dailyMessageCount,
      dailyReset: users.dailyReset,
      anonymous: users.anonymous,
      premium: users.premium,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  const isAnonymous = userData.anonymous
  const dailyLimit = isAnonymous
    ? NON_AUTH_DAILY_MESSAGE_LIMIT
    : AUTH_DAILY_MESSAGE_LIMIT

  const now = new Date()
  let dailyCount = userData.dailyMessageCount || 0
  const lastReset = userData.dailyReset ? new Date(userData.dailyReset) : null

  const isNewDay =
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()

  if (isNewDay) {
    dailyCount = 0
    await db
      .update(users)
      .set({ dailyMessageCount: 0, dailyReset: now })
      .where(eq(users.id, userId))
  }

  if (dailyCount >= dailyLimit) {
    throw new UsageLimitError("Daily message limit reached.")
  }

  return {
    userData,
    dailyCount,
    dailyLimit,
  }
}

export async function incrementUsage(userId: string): Promise<void> {
  const [userData] = await db
    .select({
      messageCount: users.messageCount,
      dailyMessageCount: users.dailyMessageCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("Error fetching user data: User not found")
  }

  const newOverallCount = (userData.messageCount || 0) + 1
  const newDailyCount = (userData.dailyMessageCount || 0) + 1

  await db
    .update(users)
    .set({
      messageCount: newOverallCount,
      dailyMessageCount: newDailyCount,
      lastActiveAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function checkProUsage(userId: string) {
  const [userData] = await db
    .select({
      dailyProMessageCount: users.dailyProMessageCount,
      dailyProReset: users.dailyProReset,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("User not found for ID: " + userId)
  }

  let dailyProCount = userData.dailyProMessageCount || 0
  const now = new Date()
  const lastReset = userData.dailyProReset
    ? new Date(userData.dailyProReset)
    : null

  const isNewDay =
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()

  if (isNewDay) {
    dailyProCount = 0
    await db
      .update(users)
      .set({ dailyProMessageCount: 0, dailyProReset: now })
      .where(eq(users.id, userId))
  }

  if (dailyProCount >= DAILY_LIMIT_PRO_MODELS) {
    throw new UsageLimitError("Daily Pro model limit reached.")
  }

  return {
    dailyProCount,
    limit: DAILY_LIMIT_PRO_MODELS,
  }
}

export async function incrementProUsage(userId: string) {
  const [userData] = await db
    .select({ dailyProMessageCount: users.dailyProMessageCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("Failed to fetch user usage for increment")
  }

  const count = userData.dailyProMessageCount || 0

  await db
    .update(users)
    .set({
      dailyProMessageCount: count + 1,
      lastActiveAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function checkUsageByModel(
  userId: string,
  _modelId: string,
  _isAuthenticated: boolean
) {
  return await checkUsage(userId)
}

export async function incrementUsageByModel(
  userId: string,
  _modelId: string,
  _isAuthenticated: boolean
) {
  return await incrementUsage(userId)
}
