import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()

    if (!supabase) {
      return NextResponse.json(
        { error: "Database connection not available" },
        { status: 503 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query parameters for filtering and pagination
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    // Fetch usage data for the user
    // Use left join to include rows where chat_id is NULL (deleted chats)
    const { data: usageData, error: usageError } = await supabase
      .from("model_usage")
      .select(
        `
        id,
        model_id,
        provider_id,
        input_tokens,
        output_tokens,
        total_tokens,
        input_cost_usd,
        output_cost_usd,
        total_cost_usd,
        created_at,
        chat_id,
        chats(title)
      `
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (usageError) {
      console.error("Error fetching usage data:", usageError)
      return NextResponse.json(
        { error: "Failed to fetch usage data" },
        { status: 500 }
      )
    }

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from("model_usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)

    if (countError) {
      console.error("Error counting usage data:", countError)
    }

    // Calculate total costs using Postgres aggregation
    const { data: totals, error: totalsError } = await supabase
      .from("model_usage")
      .select("total:total_cost_usd.sum()")
      .eq("user_id", user.id)
      .single()

    let totalCost = 0
    if (!totalsError && totals) {
      totalCost = (totals as any).total || 0
    }

    return NextResponse.json({
      usage: usageData || [],
      total: count || 0,
      totalCost,
    })
  } catch (err: unknown) {
    console.error("Error in model-usage API:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
