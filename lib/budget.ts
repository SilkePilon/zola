import { SupabaseClient } from "@supabase/supabase-js"
import { Database } from "@/app/types/database.types"

type BudgetLimits = Database["public"]["Tables"]["budget_limits"]["Row"]

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

/**
 * Check if user can proceed with a chat based on budget limits
 * Throws BudgetExceededError if budget is exceeded
 */
export async function checkBudgetBeforeChat(
  supabase: SupabaseClient<Database>,
  userId: string,
  providerId?: string,
  chatId?: string
): Promise<BudgetLimits | null> {
  // Get budget limits - check both provider-specific and global
  const { data: allBudgets, error } = await supabase
    .from("budget_limits")
    .select("*")
    .eq("user_id", userId)
    .in("provider_id", [providerId || null, null])

  if (error) {
    console.error("Error fetching budget limits:", error)
    throw new Error("Failed to check budget limits")
  }

  // No budget limits set, allow
  if (!allBudgets || allBudgets.length === 0) {
    return null
  }

  // Prioritize provider-specific budget over global
  const budgetLimits = allBudgets.find((b) => b.provider_id === providerId) || 
                       allBudgets.find((b) => b.provider_id === null) ||
                       null

  if (!budgetLimits) {
    return null
  }

  // If limits are not enforced, just return the limits
  if (!budgetLimits.enforce_limits) {
    return budgetLimits
  }

  // Check if we need to reset daily/monthly counters
  const now = new Date()
  let needsUpdate = false
  let updates: any = {}
  let currentDaySpend = budgetLimits.current_day_spend || 0
  let currentMonthSpend = budgetLimits.current_month_spend || 0

  // Check daily reset
  const dayReset = budgetLimits.day_reset
    ? new Date(budgetLimits.day_reset)
    : null
  const isDayReset =
    !dayReset ||
    now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
    now.getUTCMonth() !== dayReset.getUTCMonth() ||
    now.getUTCDate() !== dayReset.getUTCDate()

  if (isDayReset && currentDaySpend > 0) {
    needsUpdate = true
    currentDaySpend = 0
    updates.current_day_spend = 0
    updates.day_reset = now.toISOString()
  }

  // Check monthly reset
  const monthReset = budgetLimits.month_reset
    ? new Date(budgetLimits.month_reset)
    : null
  const isMonthReset =
    !monthReset ||
    now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
    now.getUTCMonth() !== monthReset.getUTCMonth()

  if (isMonthReset && currentMonthSpend > 0) {
    needsUpdate = true
    currentMonthSpend = 0
    updates.current_month_spend = 0
    updates.month_reset = now.toISOString()
  }

  // Update if needed
  if (needsUpdate) {
    // Target specific budget record by user_id + provider_id (or id as fallback)
    updates.user_id = userId
    let query = supabase
      .from("budget_limits")
      .update(updates)
      .eq("user_id", userId)
    
    if (budgetLimits.provider_id !== null && budgetLimits.provider_id !== undefined) {
      query = query.eq("provider_id", budgetLimits.provider_id)
    } else {
      query = query.eq("id", budgetLimits.id)
    }
    
    await query
  }

  // Check monthly budget (null/undefined = no limit, 0 = strict limit)
  if (
    budgetLimits.monthly_budget_usd !== null &&
    budgetLimits.monthly_budget_usd !== undefined &&
    currentMonthSpend >= budgetLimits.monthly_budget_usd
  ) {
    throw new BudgetExceededError(
      "Monthly budget limit exceeded",
      "monthly",
      currentMonthSpend,
      budgetLimits.monthly_budget_usd,
      providerId
    )
  }

  // Check daily budget (null/undefined = no limit, 0 = strict limit)
  if (
    budgetLimits.daily_budget_usd !== null &&
    budgetLimits.daily_budget_usd !== undefined &&
    currentDaySpend >= budgetLimits.daily_budget_usd
  ) {
    throw new BudgetExceededError(
      "Daily budget limit exceeded",
      "daily",
      currentDaySpend,
      budgetLimits.daily_budget_usd,
      providerId
    )
  }

  // Check per-chat budget if chatId provided (null/undefined = no limit, 0 = strict limit)
  if (
    budgetLimits.per_chat_budget_usd !== null &&
    budgetLimits.per_chat_budget_usd !== undefined &&
    chatId
  ) {
    const { data: chatSpending } = await supabase
      .from("model_usage")
      .select("total_cost_usd")
      .eq("user_id", userId)
      .eq("chat_id", chatId)

    const chatTotal =
      chatSpending?.reduce(
        (sum, usage) => sum + (usage.total_cost_usd || 0),
        0
      ) || 0

    if (chatTotal >= budgetLimits.per_chat_budget_usd) {
      throw new BudgetExceededError(
        "Per-chat budget limit exceeded",
        "per_chat",
        chatTotal,
        budgetLimits.per_chat_budget_usd,
        providerId
      )
    }
  }

  return {
    ...budgetLimits,
    current_day_spend: currentDaySpend,
    current_month_spend: currentMonthSpend,
  }
}

/**
 * Update budget spending after a successful chat completion
 * Also creates alerts if warning thresholds are reached
 */
export async function updateBudgetSpending(
  supabase: SupabaseClient<Database>,
  userId: string,
  providerId: string,
  costUsd: number
): Promise<void> {
  // Get current budget limits - check both provider-specific and global
  const { data: allBudgets, error } = await supabase
    .from("budget_limits")
    .select("*")
    .eq("user_id", userId)
    .in("provider_id", [providerId, null])

  if (error || !allBudgets || allBudgets.length === 0) {
    // No budget limits set, nothing to update
    return
  }

  // Prioritize provider-specific budget over global
  const budgetLimits = allBudgets.find((b) => b.provider_id === providerId) || 
                       allBudgets.find((b) => b.provider_id === null) ||
                       null

  if (!budgetLimits) {
    return
  }

  const currentDaySpend = (budgetLimits.current_day_spend || 0) + costUsd
  const currentMonthSpend = (budgetLimits.current_month_spend || 0) + costUsd

  // Update spending
  await supabase
    .from("budget_limits")
    .update({
      current_day_spend: currentDaySpend,
      current_month_spend: currentMonthSpend,
      user_id: userId,
    })
    .eq("user_id", userId)
    .eq("id", budgetLimits.id)

  // Check for warnings and create alerts if needed (only if budget > 0)
  const warningThreshold = budgetLimits.warning_threshold_percent || 80

  // Check monthly budget warning
  if (
    budgetLimits.monthly_budget_usd !== null &&
    budgetLimits.monthly_budget_usd !== undefined
  ) {
    // For $0 budget, show limit_reached immediately
    if (budgetLimits.monthly_budget_usd === 0) {
      await createBudgetAlert(
        supabase,
        userId,
        "limit_reached",
        "monthly",
        100,
        currentMonthSpend,
        0,
        "Monthly budget set to $0 - provider blocked"
      )
    } else {
      const monthlyPercentage =
        (currentMonthSpend / budgetLimits.monthly_budget_usd) * 100

    if (monthlyPercentage >= 100) {
      await createBudgetAlert(
        supabase,
        userId,
        "limit_reached",
        "monthly",
        100,
        currentMonthSpend,
        budgetLimits.monthly_budget_usd,
        "Monthly budget limit has been reached"
      )
    } else if (monthlyPercentage >= warningThreshold) {
      await createBudgetAlert(
        supabase,
        userId,
        "warning",
        "monthly",
        Math.round(monthlyPercentage),
        currentMonthSpend,
        budgetLimits.monthly_budget_usd,
        `Monthly budget is at ${Math.round(monthlyPercentage)}% of limit`
      )
    }
    }
  }

  // Check daily budget warning
  if (
    budgetLimits.daily_budget_usd !== null &&
    budgetLimits.daily_budget_usd !== undefined
  ) {
    // For $0 budget, show limit_reached immediately
    if (budgetLimits.daily_budget_usd === 0) {
      await createBudgetAlert(
        supabase,
        userId,
        "limit_reached",
        "daily",
        100,
        currentDaySpend,
        0,
        "Daily budget set to $0 - provider blocked"
      )
    } else {
      const dailyPercentage =
        (currentDaySpend / budgetLimits.daily_budget_usd) * 100

    if (dailyPercentage >= 100) {
      await createBudgetAlert(
        supabase,
        userId,
        "limit_reached",
        "daily",
        100,
        currentDaySpend,
        budgetLimits.daily_budget_usd,
        "Daily budget limit has been reached"
      )
    } else if (dailyPercentage >= warningThreshold) {
      await createBudgetAlert(
        supabase,
        userId,
        "warning",
        "daily",
        Math.round(dailyPercentage),
        currentDaySpend,
        budgetLimits.daily_budget_usd,
        `Daily budget is at ${Math.round(dailyPercentage)}% of limit`
      )
    }
    }
  }
}

/**
 * Create a budget alert (avoiding duplicates within the same hour)
 */
async function createBudgetAlert(
  supabase: SupabaseClient<Database>,
  userId: string,
  alertType: "warning" | "limit_reached" | "budget_exceeded",
  budgetType: "monthly" | "daily" | "per_chat",
  thresholdPercent: number,
  amountSpent: number,
  budgetLimit: number,
  message: string
): Promise<void> {
  // Check if similar alert was created in the last hour
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const { data: recentAlerts } = await supabase
    .from("budget_alerts")
    .select("id")
    .eq("user_id", userId)
    .eq("alert_type", alertType)
    .eq("budget_type", budgetType)
    .gte("created_at", oneHourAgo.toISOString())
    .limit(1)

  // Don't create duplicate alert
  if (recentAlerts && recentAlerts.length > 0) {
    return
  }

  // Create new alert
  await supabase.from("budget_alerts").insert({
    user_id: userId,
    alert_type: alertType,
    budget_type: budgetType,
    threshold_percent: thresholdPercent,
    amount_spent: amountSpent,
    budget_limit: budgetLimit,
    message,
  })
}
