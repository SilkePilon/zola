import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from "@/lib/models"
import { getCustomModels } from "@/lib/models/custom"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { ensureProviderLogosCached } from "@/lib/server/provider-logos"

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      // No supabase means no user authentication, use free models only
      const models = await getModelsWithAccessFlags()
      await ensureProviderLogosCached(
        Array.from(new Set(models.map((m) => m.providerId)))
      )
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      const models = await getModelsWithAccessFlags()
      await ensureProviderLogosCached(
        Array.from(new Set(models.map((m) => m.providerId)))
      )
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const customModels = await getCustomModels()
    
    const { data, error } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", authData.user.id)

    if (error) {
      console.error("Error fetching user keys:", error)
      const models = await getModelsWithAccessFlags(customModels)
      await ensureProviderLogosCached(
        Array.from(new Set(models.map((m) => m.providerId)))
      )
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const userProviders = data?.map((k) => k.provider) || []

    if (userProviders.length === 0) {
      const models = await getModelsWithAccessFlags(customModels)
      await ensureProviderLogosCached(
        Array.from(new Set(models.map((m) => m.providerId)))
      )
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      })
    }

    const models = await getModelsForUserProviders(userProviders, customModels)
    await ensureProviderLogosCached(
      Array.from(new Set(models.map((m) => m.providerId)))
    )

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error fetching models:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
      },
    })
  }
}

export async function POST() {
  try {
    refreshModelsCache()
    const customModels = await getCustomModels()
    const models = await getAllModels(customModels)

    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
}
