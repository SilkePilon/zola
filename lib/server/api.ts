import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"

/**
 * Validates that the claimed userId matches the actual session (for
 * authenticated requests) or an existing anonymous guest row (for
 * unauthenticated requests). Throws on any mismatch.
 */
export async function validateUserIdentity(
  userId: string,
  isAuthenticated: boolean
): Promise<boolean> {
  if (isAuthenticated) {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      throw new Error("Unable to get authenticated user")
    }

    if (session.user.id !== userId) {
      throw new Error("User ID does not match authenticated user")
    }
  } else {
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.anonymous, true)))
      .limit(1)

    if (!userRecord) {
      throw new Error("Invalid or missing guest user")
    }
  }

  return true
}
