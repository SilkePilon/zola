import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 500 }
      )
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get budget limits
    const { data: budgetLimits, error: budgetError } = await supabase
      .from("budget_limits")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (budgetError && budgetError.code !== "PGRST116") {
      console.error("Error fetching budget limits:", budgetError)
      return NextResponse.json(
        { error: "Failed to fetch budget limits" },
        { status: 500 }
      )
    }

    // If no budget limits set, return empty status
    if (!budgetLimits) {
      return NextResponse.json({
        hasBudget: false,
        status: null,
      })
    }

    // Check if we need to reset daily/monthly counters
    const now = new Date()
    let needsUpdate = false
    let updates: any = {}

    // Check daily reset
    const dayReset = budgetLimits.day_reset
      ? new Date(budgetLimits.day_reset)
      : null
    const isDayReset =
      !dayReset ||
      now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
      now.getUTCMonth() !== dayReset.getUTCMonth() ||
      now.getUTCDate() !== dayReset.getUTCDate()

    if (isDayReset && budgetLimits.current_day_spend > 0) {
      needsUpdate = true
      updates.current_day_spend = 0
      updates.day_reset = now.toISOString()
      budgetLimits.current_day_spend = 0
    }

    // Check monthly reset
    const monthReset = budgetLimits.month_reset
      ? new Date(budgetLimits.month_reset)
      : null
    const isMonthReset =
      !monthReset ||
      now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
      now.getUTCMonth() !== monthReset.getUTCMonth()

    if (isMonthReset && budgetLimits.current_month_spend > 0) {
      needsUpdate = true
      updates.current_month_spend = 0
      updates.month_reset = now.toISOString()
      budgetLimits.current_month_spend = 0
    }

    // Update if needed
    if (needsUpdate) {
      await supabase
        .from("budget_limits")
        .update(updates)
        .eq("user_id", user.id)
    }

    // Calculate status for each budget type
    const status = {
      monthly: calculateBudgetStatus(
        budgetLimits.current_month_spend || 0,
        budgetLimits.monthly_budget_usd,
        budgetLimits.warning_threshold_percent || 80
      ),
      daily: calculateBudgetStatus(
        budgetLimits.current_day_spend || 0,
        budgetLimits.daily_budget_usd,
        budgetLimits.warning_threshold_percent || 80
      ),
    }

    return NextResponse.json({
      hasBudget: true,
      budgetLimits,
      status,
    })
  } catch (err) {
    console.error("Error in budget-status GET:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function calculateBudgetStatus(
  spent: number,
  limit: number | null,
  warningThreshold: number
) {
  if (!limit || limit === 0) {
    return {
      spent,
      limit: null,
      percentage: 0,
      isWarning: false,
      isExceeded: false,
    }
  }

  const percentage = (spent / limit) * 100

  return {
    spent,
    limit,
    percentage: Math.round(percentage * 100) / 100,
    isWarning: percentage >= warningThreshold && percentage < 100,
    isExceeded: percentage >= 100,
  }
}
