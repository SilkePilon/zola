import "server-only"
import { auth } from "@/lib/auth"
import { mapUserPreferencesRow, mapUserRow } from "@/lib/db/mappers"
import { db } from "@/lib/db/client"
import { userPreferences, users } from "@/lib/db/schema"
import { convertFromApiFormat } from "@/lib/user-preference-store/utils"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import type { UserProfile } from "./types"

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return null

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  // Don't load anonymous users in the user store
  if (!profile || profile.anonymous) return null

  const [preferences] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, sessionUser.id))
    .limit(1)

  return {
    ...mapUserRow(profile),
    preferences: preferences
      ? convertFromApiFormat(mapUserPreferencesRow(preferences))
      : undefined,
  }
}
