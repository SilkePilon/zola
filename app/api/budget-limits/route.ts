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

    // Get all budget limits for the user (global + per-provider)
    const { data, error } = await supabase
      .from("budget_limits")
      .select("*")
      .eq("user_id", user.id)
      .order("provider_id", { ascending: true, nullsFirst: true })

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching budget limits:", error)
      return NextResponse.json(
        { error: "Failed to fetch budget limits" },
        { status: 500 }
      )
    }

    // Return empty array if no budget limits set
    if (!data || data.length === 0) {
      return NextResponse.json({
        budgetLimits: [],
      })
    }

    return NextResponse.json({
      budgetLimits: data,
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

    // Validate input - now accepts an array of budgets
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
        in_app_notifications,
        enforce_limits,
      } = budget

      // Check if budget limits already exist for this provider
      const { data: existing } = await supabase
        .from("budget_limits")
        .select("id")
        .eq("user_id", user.id)
        .eq("provider_id", provider_id || null)
        .maybeSingle()

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("budget_limits")
          .update({
            monthly_budget_usd,
            daily_budget_usd,
            per_chat_budget_usd,
            warning_threshold_percent,
            email_notifications,
            in_app_notifications,
            enforce_limits,
          })
          .eq("id", existing.id)
          .select()
          .single()

        if (error) {
          console.error("Error updating budget limits:", error)
          continue
        }

        results.push(data)
      } else {
        // Create new
        const { data, error } = await supabase
          .from("budget_limits")
          .insert({
            user_id: user.id,
            provider_id: provider_id || null,
            monthly_budget_usd,
            daily_budget_usd,
            per_chat_budget_usd,
            warning_threshold_percent,
            email_notifications,
            in_app_notifications,
            enforce_limits,
          })
          .select()
          .single()

        if (error) {
          console.error("Error creating budget limits:", error)
          continue
        }

        results.push(data)
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

    const { error } = await supabase
      .from("budget_limits")
      .delete()
      .eq("user_id", user.id)

    if (error) {
      console.error("Error deleting budget limits:", error)
      return NextResponse.json(
        { error: "Failed to delete budget limits" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error in budget-limits DELETE:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
