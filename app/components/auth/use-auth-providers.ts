"use client"

import { NO_SOCIAL_PROVIDERS, type AuthProviders } from "@/lib/auth-shared"
import { useQuery } from "@tanstack/react-query"

/**
 * Fetches which social providers this deployment configured.
 *
 * For client components that cannot receive the providers as props from a
 * server component. Server components should call `getAuthProviders()` from
 * lib/auth-providers.ts directly instead — it avoids this request entirely.
 *
 * While loading, reports no social providers, so callers render the
 * always-available email/password path rather than flashing buttons that may
 * not exist.
 */
export function useAuthProviders(): {
  providers: AuthProviders
  isLoading: boolean
} {
  const { data, isLoading } = useQuery<AuthProviders>({
    queryKey: ["auth-providers"],
    queryFn: async () => {
      const res = await fetch("/api/auth-providers")
      if (!res.ok) throw new Error("Failed to load auth providers")
      return res.json()
    },
    // Provider configuration is fixed for the lifetime of the server process.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  })

  return { providers: data ?? NO_SOCIAL_PROVIDERS, isLoading }
}
