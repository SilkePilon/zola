import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapBudgetAlertRow } from "@/lib/db/mappers"
import { budgetAlerts } from "@/lib/db/schema"
import { and, count, desc, eq, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const unacknowledgedOnly = searchParams.get("unacknowledged") === "true"

    const conditions = [eq(budgetAlerts.userId, session.user.id)]
    if (unacknowledgedOnly) {
      conditions.push(eq(budgetAlerts.acknowledged, false))
    }
    const where = and(...conditions)

    const [data, totalRows] = await Promise.all([
      db
        .select()
        .from(budgetAlerts)
        .where(where)
        .orderBy(desc(budgetAlerts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(budgetAlerts).where(where),
    ])

    return NextResponse.json({
      alerts: data.map(mapBudgetAlertRow),
      total: totalRows[0]?.value ?? 0,
    })
  } catch (err) {
    console.error("Error in budget-alerts GET:", err)
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
    const { alertIds } = body

    if (!alertIds || !Array.isArray(alertIds)) {
      return NextResponse.json(
        { error: "Invalid alert IDs" },
        { status: 400 }
      )
    }

    await db
      .update(budgetAlerts)
      .set({ acknowledged: true })
      .where(
        and(
          eq(budgetAlerts.userId, session.user.id),
          inArray(budgetAlerts.id, alertIds)
        )
      )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error in budget-alerts POST:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
