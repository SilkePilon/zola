import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapBudgetLimitRow } from "@/lib/db/mappers"
import { budgetLimits } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await db
      .select()
      .from(budgetLimits)
      .where(eq(budgetLimits.userId, session.user.id))

    if (rows.length === 0) {
      return NextResponse.json({
        hasBudget: false,
        budgetLimits: [],
        status: [],
      })
    }

    const now = new Date()
    const updatedRows = []

    for (const row of rows) {
      const updates: {
        currentDaySpend?: string
        dayReset?: Date
        currentMonthSpend?: string
        monthReset?: Date
        updatedAt?: Date
      } = {}

      const dayReset = row.dayReset ? new Date(row.dayReset) : null
      const isDayReset =
        !dayReset ||
        now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
        now.getUTCMonth() !== dayReset.getUTCMonth() ||
        now.getUTCDate() !== dayReset.getUTCDate()

      if (isDayReset && Number(row.currentDaySpend ?? 0) > 0) {
        updates.currentDaySpend = "0"
        updates.dayReset = now
      }

      const monthReset = row.monthReset ? new Date(row.monthReset) : null
      const isMonthReset =
        !monthReset ||
        now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
        now.getUTCMonth() !== monthReset.getUTCMonth()

      if (isMonthReset && Number(row.currentMonthSpend ?? 0) > 0) {
        updates.currentMonthSpend = "0"
        updates.monthReset = now
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now
        const [updated] = await db
          .update(budgetLimits)
          .set(updates)
          .where(eq(budgetLimits.id, row.id))
          .returning()
        updatedRows.push(updated)
      } else {
        updatedRows.push(row)
      }
    }

    const mapped = updatedRows.map(mapBudgetLimitRow)

    const statuses = mapped.map((row) => ({
      id: row.id,
      provider_id: row.provider_id,
      monthly: calculateBudgetStatus(
        row.current_month_spend,
        row.monthly_budget_usd,
        row.warning_threshold_percent
      ),
      daily: calculateBudgetStatus(
        row.current_day_spend,
        row.daily_budget_usd,
        row.warning_threshold_percent
      ),
    }))

    return NextResponse.json({
      hasBudget: true,
      budgetLimits: mapped,
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
