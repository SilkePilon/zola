import { auth } from "@/lib/auth"
import { getEffectiveApiKey, ProviderWithoutOllama } from "@/lib/user-keys"
import { NextRequest, NextResponse } from "next/server"
import { getAllModels } from "@/lib/models"
import { ensureProviderLogosCached } from "@/lib/server/provider-logos"
import { headers } from "next/headers"

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

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user || session.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

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
