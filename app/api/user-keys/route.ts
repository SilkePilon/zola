import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userKeys, users } from "@/lib/db/schema"
import { encryptKey } from "@/lib/encryption"
import { getModelsForProvider } from "@/lib/models"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API key are required" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { encrypted, iv } = encryptKey(apiKey)

    const [existingKey] = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(
        and(
          eq(userKeys.userId, session.user.id),
          eq(userKeys.provider, provider)
        )
      )
      .limit(1)

    const isNewKey = !existingKey

    await db
      .insert(userKeys)
      .values({
        userId: session.user.id,
        provider,
        encryptedKey: encrypted,
        iv,
      })
      .onConflictDoUpdate({
        target: [userKeys.userId, userKeys.provider],
        set: { encryptedKey: encrypted, iv, updatedAt: new Date() },
      })

    if (isNewKey) {
      try {
        const [userData] = await db
          .select({ favoriteModels: users.favoriteModels })
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1)

        const currentFavorites = userData?.favoriteModels || []

        const providerModels = await getModelsForProvider(provider)
        if (!providerModels || providerModels.length === 0) {
          return NextResponse.json({
            success: true,
            isNewKey,
            message: "API key saved",
          })
        }
        const mostRecent = providerModels
          .slice()
          .sort((a, b) => {
            const ta = a.updatedAt || a.releasedAt || ""
            const tb = b.updatedAt || b.releasedAt || ""
            return (tb || "").localeCompare(ta || "")
          })[0]

        if (mostRecent && !currentFavorites.includes(mostRecent.id)) {
          await db
            .update(users)
            .set({ favoriteModels: [...currentFavorites, mostRecent.id] })
            .where(eq(users.id, session.user.id))
        }
      } catch (modelsError) {
        console.error("Failed to update favorite models:", modelsError)
      }
    }

    return NextResponse.json({
      success: true,
      isNewKey,
      message: isNewKey
        ? `API key saved and ${provider} models added to favorites`
        : "API key updated",
    })
  } catch (error) {
    console.error("Error in POST /api/user-keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { provider } = await request.json()

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db
      .delete(userKeys)
      .where(
        and(
          eq(userKeys.userId, session.user.id),
          eq(userKeys.provider, provider)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/user-keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
