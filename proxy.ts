import { NextResponse, type NextRequest } from "next/server"
import { validateCsrfToken } from "./lib/csrf"

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  // CSRF protection for state-changing requests.
  // Better Auth's own client (signIn.social, signOut, signIn.anonymous) posts
  // to /api/auth/* directly — it does not go through lib/fetch.ts's fetchClient,
  // so it never attaches x-csrf-token. Better Auth ships its own CSRF/origin
  // protection for its own routes, so those paths are exempt from this check.
  const isBetterAuthRoute = request.nextUrl.pathname.startsWith("/api/auth")
  if (
    !isBetterAuthRoute &&
    ["POST", "PUT", "DELETE"].includes(request.method)
  ) {
    const csrfCookie = request.cookies.get("csrf_token")?.value
    const headerToken = request.headers.get("x-csrf-token")

    if (!csrfCookie || !headerToken || !validateCsrfToken(headerToken)) {
      return new NextResponse("Invalid CSRF token", { status: 403 })
    }
  }

  // CSP for development and production
  const isDev = process.env.NODE_ENV === "development"

  response.headers.set(
    "Content-Security-Policy",
    isDev
      ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://assets.onedollarstats.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://accounts.google.com https://api.github.com https://collector.onedollarstats.com https://models.dev;`
      : `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com https://analytics.umami.is https://vercel.live https://assets.onedollarstats.com; frame-src 'self' https://vercel.live; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; connect-src 'self' wss: https://api.openai.com https://api.mistral.ai https://accounts.google.com https://api-gateway.umami.dev https://api.github.com https://collector.onedollarstats.com https://models.dev;`
  )

  return response
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
