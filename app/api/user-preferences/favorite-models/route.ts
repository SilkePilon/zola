import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { favorite_models } = body

    if (!Array.isArray(favorite_models)) {
      return NextResponse.json(
        { error: "favorite_models must be an array" },
        { status: 400 }
      )
    }

    if (!favorite_models.every((model) => typeof model === "string")) {
      return NextResponse.json(
        { error: "All favorite_models must be strings" },
        { status: 400 }
      )
    }

    const [data] = await db
      .update(users)
      .set({ favoriteModels: favorite_models })
      .where(eq(users.id, session.user.id))
      .returning({ favoriteModels: users.favoriteModels })

    return NextResponse.json({
      success: true,
      favorite_models: data.favoriteModels,
    })
  } catch (error) {
    console.error("Error in favorite-models API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .select({ favoriteModels: users.favoriteModels })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    return NextResponse.json({
      favorite_models: data?.favoriteModels || [],
    })
  } catch (error) {
    console.error("Error in favorite-models GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
