import { createClient } from "@/lib/supabase/server"
import { getEffectiveApiKey, ProviderWithoutOllama } from "@/lib/user-keys"
import { NextRequest, NextResponse } from "next/server"
import { getAllModels } from "@/lib/models"
import { ensureProviderLogosCached } from "@/lib/server/provider-logos"

export async function GET() {
  try {
    const models = await getAllModels()

    const map = new Map<
      string,
      { id: string; name: string; logoUrl?: string; count: number }
    >()
    for (const m of models) {
      const id = m.providerId
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: m.provider,
          logoUrl: m.logoUrl,
          count: 1,
        })
      } else {
        const entry = map.get(id)!
        entry.count += 1
      }
    }

    const providers = Array.from(map.values()).sort((a, b) => b.count - a.count)

    // Ensure provider logos are cached locally for same-origin serving
    await ensureProviderLogosCached(providers.map((p) => p.id))
    return NextResponse.json({ providers })
  } catch (error) {
    console.error("Error listing providers:", error)
    return NextResponse.json(
      { error: "Failed to list providers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider, userId } = await request.json()

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 500 }
      )
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Skip Ollama since it doesn't use API keys
    if (provider === "ollama") {
      return NextResponse.json({
        hasUserKey: false,
        provider,
      })
    }

    const apiKey = await getEffectiveApiKey(
      userId,
      provider as ProviderWithoutOllama
    )

    // Only check if user has their own API key (no env variables)
    return NextResponse.json({
      hasUserKey: !!apiKey,
      provider,
    })
  } catch (error) {
    console.error("Error checking provider keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
