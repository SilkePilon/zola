import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userKeys } from "@/lib/db/schema"
import { getAllModels } from "@/lib/models"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(eq(userKeys.userId, session.user.id))

    const models = await getAllModels()
    const dynamicProviders = new Set<string>(models.map((m) => m.providerId))

    const userProviders = new Set<string>(rows.map((k) => k.provider))
    const providerStatus: Record<string, boolean> = {}
    for (const id of dynamicProviders) {
      providerStatus[id] = userProviders.has(id)
    }
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
