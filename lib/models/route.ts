import { createClient } from "@/lib/supabase/server"
import { getEffectiveApiKey, ProviderWithoutOllama } from "@/lib/user-keys"
import { NextRequest, NextResponse } from "next/server"
import { getAllModels } from "@/lib/models"

export async function GET() {
  try {
    const models = await getAllModels()

    // Group unique providers from models
    const map = new Map<string, { id: string; name: string; logoUrl?: string; count: number }>()
    for (const m of models) {
      const id = m.providerId
      if (!map.has(id)) {
        map.set(id, { id, name: m.provider, logoUrl: m.logoUrl, count: 1 })
      } else {
        const entry = map.get(id)!
        entry.count += 1
      }
    }

    const providers = Array.from(map.values()).sort((a, b) => b.count - a.count)

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

    const envKeyMap: Record<ProviderWithoutOllama, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      mistral: process.env.MISTRAL_API_KEY,
      perplexity: process.env.PERPLEXITY_API_KEY,
      google: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      xai: process.env.XAI_API_KEY,
      openrouter: process.env.OPENROUTER_API_KEY,
    }

    return NextResponse.json({
      hasUserKey:
        !!apiKey && apiKey !== envKeyMap[provider as ProviderWithoutOllama],
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
