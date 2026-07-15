import { getAuthProviders } from "@/lib/auth-providers"
import { NextResponse } from "next/server"

// Named /api/auth-providers rather than /api/auth/providers so it does not
// collide with Better Auth's /api/auth/[...all] catch-all handler.
//
// Deliberately public and unauthenticated: the sign-in UI needs it before a
// session exists. It only reports whether credentials are configured, never
// their values.

// Without this Next.js would prerender the response at build time, baking in
// build-time env vars — wrong for Docker images built before credentials exist.
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(getAuthProviders())
}
