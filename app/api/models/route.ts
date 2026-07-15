import {
  getAllModels,
  getModelsForUserProviders,
  refreshModelsCache,
} from "@/lib/models"
import { getCustomModels } from "@/lib/models/custom"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userKeys } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
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
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user) {
      const models = await getAllModels()
      return respondWithModels(models)
    }

    const customModelsResult = await getCustomModels()
    const customModels = customModelsResult?.length
      ? customModelsResult
      : undefined

    const rows = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(eq(userKeys.userId, session.user.id))

    const userProviders = rows.map((k) => k.provider)

    if (userProviders.length === 0) {
      const models = await getAllModels(customModels)
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
