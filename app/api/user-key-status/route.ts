import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getAllModels } from "@/lib/models"

export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase not available" },
        { status: 500 }
      )
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", authData.user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Build dynamic list of providers from models
    const models = await getAllModels()
    const dynamicProviders = new Set<string>(
      models.map((m) => m.providerId)
    )

    const userProviders = new Set<string>((data || []).map((k) => k.provider))
    const providerStatus: Record<string, boolean> = {}
    for (const id of dynamicProviders) {
      providerStatus[id] = userProviders.has(id)
    }
    // Also include any stray providers that exist only in user_keys
    for (const id of userProviders) {
      providerStatus[id] = true
    }

    return NextResponse.json(providerStatus)
  } catch (err) {
    console.error("Key status error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
