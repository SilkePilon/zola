import "server-only"
import type { AuthProviders } from "@/lib/auth-shared"

/**
 * Reports which social providers this deployment configured.
 *
 * Reads the same env vars that lib/auth.ts uses to register providers, so the
 * UI never offers a button that Better Auth would reject. Server-only: outside
 * a server context Next.js replaces non-`NEXT_PUBLIC_` env vars with undefined,
 * which would silently report every provider as unconfigured.
 */
export function getAuthProviders(): AuthProviders {
  return {
    google: Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ),
    github: Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ),
  }
}
