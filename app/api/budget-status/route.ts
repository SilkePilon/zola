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

    // Get all budget limits for this user
    const { data: budgetLimitsArray, error: budgetError } = await supabase
      .from("budget_limits")
      .select("*")
      .eq("user_id", user.id)

    if (budgetError) {
      console.error("Error fetching budget limits:", budgetError)
      return NextResponse.json(
        { error: "Failed to fetch budget limits" },
        { status: 500 }
      )
    }

    // If no budget limits set, return empty status
    if (!budgetLimitsArray || budgetLimitsArray.length === 0) {
      return NextResponse.json({
        hasBudget: false,
        budgetLimits: [],
        status: [],
      })
    }

    // Check if we need to reset daily/monthly counters for each budget limit
    const now = new Date()
    const updatedBudgetLimits = []

    for (let budgetLimit of budgetLimitsArray) {
      let needsUpdate = false
      let updates: any = {}

      // Check daily reset
      const dayReset = budgetLimit.day_reset
        ? new Date(budgetLimit.day_reset)
        : null
      const isDayReset =
        !dayReset ||
        now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
        now.getUTCMonth() !== dayReset.getUTCMonth() ||
        now.getUTCDate() !== dayReset.getUTCDate()

      if (isDayReset && (budgetLimit.current_day_spend ?? 0) > 0) {
        needsUpdate = true
        updates.current_day_spend = 0
        updates.day_reset = now.toISOString()
      }

      // Check monthly reset
      const monthReset = budgetLimit.month_reset
        ? new Date(budgetLimit.month_reset)
        : null
      const isMonthReset =
        !monthReset ||
        now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
        now.getUTCMonth() !== monthReset.getUTCMonth()

      if (isMonthReset && (budgetLimit.current_month_spend ?? 0) > 0) {
        needsUpdate = true
        updates.current_month_spend = 0
        updates.month_reset = now.toISOString()
      }

      // Update if needed and get the updated row
      if (needsUpdate) {
        const { data: updatedRow, error: updateError } = await supabase
          .from("budget_limits")
          .update(updates)
          .eq("id", budgetLimit.id)
          .select()
          .single()

        if (updateError) {
          console.error("Error updating budget limit:", updateError)
          // Continue with the non-updated row
          updatedBudgetLimits.push(budgetLimit)
        } else {
          // Use the updated row with new timestamps
          updatedBudgetLimits.push(updatedRow)
        }
      } else {
        updatedBudgetLimits.push(budgetLimit)
      }
    }

    // Calculate status for each budget limit row
    const statuses = updatedBudgetLimits.map((budgetLimit) => ({
      id: budgetLimit.id,
      provider_id: budgetLimit.provider_id,
      monthly: calculateBudgetStatus(
        budgetLimit.current_month_spend || 0,
        budgetLimit.monthly_budget_usd,
        budgetLimit.warning_threshold_percent || 80
      ),
      daily: calculateBudgetStatus(
        budgetLimit.current_day_spend || 0,
        budgetLimit.daily_budget_usd,
        budgetLimit.warning_threshold_percent || 80
      ),
    }))

    return NextResponse.json({
      hasBudget: true,
      budgetLimits: updatedBudgetLimits,
      status: statuses,
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
