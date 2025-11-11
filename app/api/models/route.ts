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

async function respondWithModels(models: any[]) {
  await ensureProviderLogosCached(
    Array.from(new Set(models.map((m) => m.providerId)))
  )
  return new Response(JSON.stringify({ models }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

export async function GET() {
  try {
    const supabase = await createClient()

    if (!supabase) {
      const models = await getModelsWithAccessFlags()
      return respondWithModels(models)
    }

    const { data: authData } = await supabase.auth.getUser()

    if (!authData?.user?.id) {
      const models = await getModelsWithAccessFlags()
      return respondWithModels(models)
    }

    // Convert empty array to undefined to avoid cache miss in getAllModels
    const customModelsResult = await getCustomModels()
    const customModels = customModelsResult?.length ? customModelsResult : undefined
    
    const { data, error } = await supabase
      .from("user_keys")
      .select("provider")
      .eq("user_id", authData.user.id)

    if (error) {
      console.error("Error fetching user keys:", error)
      const models = await getModelsWithAccessFlags(customModels)
      return respondWithModels(models)
    }

    const userProviders = data?.map((k) => k.provider) || []

    if (userProviders.length === 0) {
      const models = await getModelsWithAccessFlags(customModels)
      return respondWithModels(models)
    }

    const models = await getModelsForUserProviders(userProviders, customModels)
    return respondWithModels(models)
  } catch (error) {
    console.error("Error fetching models:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
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
