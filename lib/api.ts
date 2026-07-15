import { APP_DOMAIN } from "@/lib/config"
import { authClient } from "@/lib/auth-client"
import type { UserProfile } from "@/lib/user/types"
import { fetchClient } from "./fetch"
import { API_ROUTE_UPDATE_CHAT_MODEL } from "./routes"

export class UsageLimitError extends Error {
  code: string
  constructor(message: string) {
    super(message)
    this.code = "DAILY_LIMIT_REACHED"
  }
}

/**
 * Checks the user's daily usage and increments both overall and daily counters.
 * Resets the daily counter if a new day (UTC) is detected.
 * Uses the `anonymous` flag from the user record to decide which daily limit applies.
 *
 * @param supabase - Your Supabase client.
 * @param userId - The ID of the user.
 * @returns The remaining daily limit.
 */
export async function checkRateLimits(
  userId: string,
  isAuthenticated: boolean
) {
  try {
    const res = await fetchClient(
      `/api/rate-limits?userId=${userId}&isAuthenticated=${isAuthenticated}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    )
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to check rate limits: ${res.status} ${res.statusText}`
      )
    }
    return responseData
  } catch (err) {
    console.error("Error checking rate limits:", err)
    throw err
  }
}

/**
 * Updates the model for an existing chat
 */
export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}

/**
 * Signs in user with Google OAuth via Better Auth
 * @param redirectPath - Optional path to redirect to after successful login (defaults to current path or /)
 */
export async function signInWithGoogle(redirectPath?: string) {
  try {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL
          ? process.env.NEXT_PUBLIC_SITE_URL
          : process.env.NEXT_PUBLIC_VERCEL_URL
            ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
            : APP_DOMAIN

    let nextPath = redirectPath

    if (!nextPath && typeof window !== "undefined") {
      const currentPath = `${window.location.pathname}${window.location.search}`
      nextPath = currentPath.startsWith("/auth") ? "/" : currentPath || "/"
    }

    nextPath = nextPath || "/"

    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${baseUrl}${nextPath}`,
    })

    if (error) {
      throw new Error(error.message)
    }
  } catch (err) {
    console.error("Error signing in with Google:", err)
    throw err
  }
}

export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => {
  if (user?.id) return user.id

  const { data: session } = await authClient.getSession()
  if (session?.user?.id) return session.user.id

  try {
    const { data, error } = await authClient.signIn.anonymous()

    if (error || !data?.user) {
      console.error("Error during anonymous sign-in:", error)
      return null
    }

    return data.user.id
  } catch (error) {
    console.error(
      "Error in getOrCreateGuestUserId during anonymous sign-in:",
      error
    )
    return null
  }
}
