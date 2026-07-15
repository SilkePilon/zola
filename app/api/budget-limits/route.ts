import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapBudgetLimitRow } from "@/lib/db/mappers"
import { budgetLimits } from "@/lib/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await db
      .select()
      .from(budgetLimits)
      .where(eq(budgetLimits.userId, session.user.id))
      .orderBy(asc(budgetLimits.providerId))

    return NextResponse.json({
      budgetLimits: data.map(mapBudgetLimitRow),
    })
  } catch (err) {
    console.error("Error in budget-limits GET:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { budgets } = body

    if (!Array.isArray(budgets) || budgets.length === 0) {
      return NextResponse.json(
        { error: "Invalid budget data" },
        { status: 400 }
      )
    }

    const results = []

    for (const budget of budgets) {
      const {
        provider_id,
        monthly_budget_usd,
        daily_budget_usd,
        per_chat_budget_usd,
        warning_threshold_percent,
        email_notifications,
        enforce_limits,
      } = budget

      const providerCondition = provider_id
        ? eq(budgetLimits.providerId, provider_id)
        : isNull(budgetLimits.providerId)

      const [existing] = await db
        .select({ id: budgetLimits.id })
        .from(budgetLimits)
        .where(and(eq(budgetLimits.userId, session.user.id), providerCondition))
        .limit(1)

      const values = {
        monthlyBudgetUsd:
          monthly_budget_usd !== undefined && monthly_budget_usd !== null
            ? String(monthly_budget_usd)
            : null,
        dailyBudgetUsd:
          daily_budget_usd !== undefined && daily_budget_usd !== null
            ? String(daily_budget_usd)
            : null,
        perChatBudgetUsd:
          per_chat_budget_usd !== undefined && per_chat_budget_usd !== null
            ? String(per_chat_budget_usd)
            : null,
        warningThresholdPercent: warning_threshold_percent,
        emailNotifications: email_notifications,
        enforceLimits: enforce_limits,
      }

      if (existing) {
        const [data] = await db
          .update(budgetLimits)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(budgetLimits.id, existing.id))
          .returning()

        results.push(mapBudgetLimitRow(data))
      } else {
        const [data] = await db
          .insert(budgetLimits)
          .values({
            userId: session.user.id,
            providerId: provider_id || null,
            ...values,
          })
          .returning()

        results.push(mapBudgetLimitRow(data))
      }
    }

    return NextResponse.json({
      budgetLimits: results,
    })
  } catch (err) {
    console.error("Error in budget-limits POST:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db
      .delete(budgetLimits)
      .where(eq(budgetLimits.userId, session.user.id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error in budget-limits DELETE:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
