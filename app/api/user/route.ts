import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import {
  mapUserPreferencesRow,
  mapUserProfileUpdates,
  mapUserRow,
} from "@/lib/db/mappers"
import { userPreferences, users } from "@/lib/db/schema"
import { convertFromApiFormat } from "@/lib/user-preference-store/utils"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!profile || profile.anonymous) {
    return NextResponse.json({ user: null })
  }

  const [preferences] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1)

  return NextResponse.json({
    user: {
      ...mapUserRow(profile),
      preferences: preferences
        ? convertFromApiFormat(mapUserPreferencesRow(preferences))
        : undefined,
    },
  })
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const updates = await request.json()

  await db
    .update(users)
    .set(mapUserProfileUpdates(updates))
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ success: true })
}
