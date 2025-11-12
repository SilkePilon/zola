import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const unacknowledgedOnly = searchParams.get("unacknowledged") === "true"

    // Build query
    let query = supabase
      .from("budget_alerts")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (unacknowledgedOnly) {
      query = query.eq("acknowledged", false)
    }

    const { data, error, count } = await query.range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching budget alerts:", error)
      return NextResponse.json(
        { error: "Failed to fetch budget alerts" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      alerts: data || [],
      total: count || 0,
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

    const body = await req.json()
    const { alertIds } = body

    if (!alertIds || !Array.isArray(alertIds)) {
      return NextResponse.json(
        { error: "Invalid alert IDs" },
        { status: 400 }
      )
    }

    // Acknowledge alerts
    const { error } = await supabase
      .from("budget_alerts")
      .update({ acknowledged: true })
      .eq("user_id", user.id)
      .in("id", alertIds)

    if (error) {
      console.error("Error acknowledging alerts:", error)
      return NextResponse.json(
        { error: "Failed to acknowledge alerts" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error in budget-alerts POST:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
