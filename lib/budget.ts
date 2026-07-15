import "server-only"
import { db } from "@/lib/db/client"
import { budgetAlerts, budgetLimits, modelUsage } from "@/lib/db/schema"
import { and, eq, gte, isNull, or } from "drizzle-orm"

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public budgetType: "monthly" | "daily" | "per_chat",
    public spent: number,
    public limit: number,
    public provider?: string
  ) {
    super(message)
    this.name = "BudgetExceededError"
  }
}

export async function checkBudgetBeforeChat(
  userId: string,
  providerId?: string,
  chatId?: string
) {
  const allBudgets = await db
    .select()
    .from(budgetLimits)
    .where(
      and(
        eq(budgetLimits.userId, userId),
        or(
          providerId ? eq(budgetLimits.providerId, providerId) : undefined,
          isNull(budgetLimits.providerId)
        )
      )
    )

  if (allBudgets.length === 0) {
    return null
  }

  const budget =
    allBudgets.find((b) => b.providerId === providerId) ||
    allBudgets.find((b) => b.providerId === null) ||
    null

  if (!budget) {
    return null
  }

  if (!budget.enforceLimits) {
    return budget
  }

  const now = new Date()
  let currentDaySpend = Number(budget.currentDaySpend ?? 0)
  let currentMonthSpend = Number(budget.currentMonthSpend ?? 0)

  const dayReset = budget.dayReset ? new Date(budget.dayReset) : null
  const isDayReset =
    !dayReset ||
    now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
    now.getUTCMonth() !== dayReset.getUTCMonth() ||
    now.getUTCDate() !== dayReset.getUTCDate()

  const monthReset = budget.monthReset ? new Date(budget.monthReset) : null
  const isMonthReset =
    !monthReset ||
    now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
    now.getUTCMonth() !== monthReset.getUTCMonth()

  const resetUpdates: {
    currentDaySpend?: string
    dayReset?: Date
    currentMonthSpend?: string
    monthReset?: Date
    updatedAt?: Date
  } = {}
  if (isDayReset && currentDaySpend > 0) {
    currentDaySpend = 0
    resetUpdates.currentDaySpend = "0"
    resetUpdates.dayReset = now
  }
  if (isMonthReset && currentMonthSpend > 0) {
    currentMonthSpend = 0
    resetUpdates.currentMonthSpend = "0"
    resetUpdates.monthReset = now
  }

  if (Object.keys(resetUpdates).length > 0) {
    resetUpdates.updatedAt = now
    await db
      .update(budgetLimits)
      .set(resetUpdates)
      .where(eq(budgetLimits.id, budget.id))
  }

  const monthlyBudgetUsd =
    budget.monthlyBudgetUsd !== null ? Number(budget.monthlyBudgetUsd) : null
  if (monthlyBudgetUsd !== null && currentMonthSpend >= monthlyBudgetUsd) {
    throw new BudgetExceededError(
      "Monthly budget limit exceeded",
      "monthly",
      currentMonthSpend,
      monthlyBudgetUsd,
      providerId
    )
  }

  const dailyBudgetUsd =
    budget.dailyBudgetUsd !== null ? Number(budget.dailyBudgetUsd) : null
  if (dailyBudgetUsd !== null && currentDaySpend >= dailyBudgetUsd) {
    throw new BudgetExceededError(
      "Daily budget limit exceeded",
      "daily",
      currentDaySpend,
      dailyBudgetUsd,
      providerId
    )
  }

  const perChatBudgetUsd =
    budget.perChatBudgetUsd !== null ? Number(budget.perChatBudgetUsd) : null
  if (perChatBudgetUsd !== null && chatId) {
    const chatSpending = await db
      .select({ totalCostUsd: modelUsage.totalCostUsd })
      .from(modelUsage)
      .where(
        and(eq(modelUsage.userId, userId), eq(modelUsage.chatId, chatId))
      )

    const chatTotal = chatSpending.reduce(
      (sum, usage) => sum + Number(usage.totalCostUsd ?? 0),
      0
    )

    if (chatTotal >= perChatBudgetUsd) {
      throw new BudgetExceededError(
        "Per-chat budget limit exceeded",
        "per_chat",
        chatTotal,
        perChatBudgetUsd,
        providerId
      )
    }
  }

  return {
    ...budget,
    currentDaySpend: String(currentDaySpend),
    currentMonthSpend: String(currentMonthSpend),
  }
}

export async function updateBudgetSpending(
  userId: string,
  providerId: string,
  costUsd: number
): Promise<void> {
  const allBudgets = await db
    .select()
    .from(budgetLimits)
    .where(
      and(
        eq(budgetLimits.userId, userId),
        or(eq(budgetLimits.providerId, providerId), isNull(budgetLimits.providerId))
      )
    )

  if (allBudgets.length === 0) {
    return
  }

  const budget =
    allBudgets.find((b) => b.providerId === providerId) ||
    allBudgets.find((b) => b.providerId === null) ||
    null

  if (!budget) {
    return
  }

  const currentDaySpend = Number(budget.currentDaySpend ?? 0) + costUsd
  const currentMonthSpend = Number(budget.currentMonthSpend ?? 0) + costUsd

  await db
    .update(budgetLimits)
    .set({
      currentDaySpend: String(currentDaySpend),
      currentMonthSpend: String(currentMonthSpend),
      updatedAt: new Date(),
    })
    .where(eq(budgetLimits.id, budget.id))

  const warningThreshold = budget.warningThresholdPercent || 80

  const monthlyBudgetUsd =
    budget.monthlyBudgetUsd !== null ? Number(budget.monthlyBudgetUsd) : null
  if (monthlyBudgetUsd !== null) {
    if (monthlyBudgetUsd === 0) {
      await createBudgetAlert(
        userId,
        "limit_reached",
        "monthly",
        100,
        currentMonthSpend,
        0,
        "Monthly budget set to $0 - provider blocked"
      )
    } else {
      const monthlyPercentage = (currentMonthSpend / monthlyBudgetUsd) * 100

      if (monthlyPercentage >= 100) {
        await createBudgetAlert(
          userId,
          "limit_reached",
          "monthly",
          100,
          currentMonthSpend,
          monthlyBudgetUsd,
          "Monthly budget limit has been reached"
        )
      } else if (monthlyPercentage >= warningThreshold) {
        await createBudgetAlert(
          userId,
          "warning",
          "monthly",
          Math.round(monthlyPercentage),
          currentMonthSpend,
          monthlyBudgetUsd,
          `Monthly budget is at ${Math.round(monthlyPercentage)}% of limit`
        )
      }
    }
  }

  const dailyBudgetUsd =
    budget.dailyBudgetUsd !== null ? Number(budget.dailyBudgetUsd) : null
  if (dailyBudgetUsd !== null) {
    if (dailyBudgetUsd === 0) {
      await createBudgetAlert(
        userId,
        "limit_reached",
        "daily",
        100,
        currentDaySpend,
        0,
        "Daily budget set to $0 - provider blocked"
      )
    } else {
      const dailyPercentage = (currentDaySpend / dailyBudgetUsd) * 100

      if (dailyPercentage >= 100) {
        await createBudgetAlert(
          userId,
          "limit_reached",
          "daily",
          100,
          currentDaySpend,
          dailyBudgetUsd,
          "Daily budget limit has been reached"
        )
      } else if (dailyPercentage >= warningThreshold) {
        await createBudgetAlert(
          userId,
          "warning",
          "daily",
          Math.round(dailyPercentage),
          currentDaySpend,
          dailyBudgetUsd,
          `Daily budget is at ${Math.round(dailyPercentage)}% of limit`
        )
      }
    }
  }
}

async function createBudgetAlert(
  userId: string,
  alertType: "warning" | "limit_reached" | "budget_exceeded",
  budgetType: "monthly" | "daily" | "per_chat",
  thresholdPercent: number,
  amountSpent: number,
  budgetLimit: number,
  message: string
): Promise<void> {
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const recentAlerts = await db
    .select({ id: budgetAlerts.id })
    .from(budgetAlerts)
    .where(
      and(
        eq(budgetAlerts.userId, userId),
        eq(budgetAlerts.alertType, alertType),
        eq(budgetAlerts.budgetType, budgetType),
        gte(budgetAlerts.createdAt, oneHourAgo)
      )
    )
    .limit(1)

  if (recentAlerts.length > 0) {
    return
  }

  await db.insert(budgetAlerts).values({
    userId,
    alertType,
    budgetType,
    thresholdPercent,
    amountSpent: String(amountSpent),
    budgetLimit: String(budgetLimit),
    message,
  })
}
