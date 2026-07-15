import "server-only"
import { MIN_PASSWORD_LENGTH } from "@/lib/auth-shared"
import * as authSchema from "@/lib/db/auth-schema"
import { db } from "@/lib/db/client"
import { reassignUserData } from "@/lib/db/reassign-user"
import { users } from "@/lib/db/schema"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { anonymous } from "better-auth/plugins"

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required")
}

// Social providers are optional: each is only registered when both of its
// credentials are set. Email/password is always enabled, so there is always at
// least one way to sign in. `getAuthProviders()` in lib/auth-providers.ts reads
// the same env vars to tell the UI which buttons to render — keep the two in sync.
const socialProviders: NonNullable<
  Parameters<typeof betterAuth>[0]["socialProviders"]
> = {}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    // No transactional email sender is configured in this app, so verification
    // emails cannot be delivered — requiring them would lock every new account out.
    requireEmailVerification: false,
  },
  socialProviders,
  plugins: [
    anonymous({
      // Confirmed against node_modules/better-auth/dist/plugins/anonymous/types.d.mts:
      // onLinkAccount receives { anonymousUser: { user, session }, newUser: { user, session }, ctx }
      // — both anonymousUser and newUser are nested under `.user`, matching the plan's assumption.
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await reassignUserData(anonymousUser.user.id, newUser.user.id)
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // Confirmed against node_modules/@better-auth/core/src/types/init-options.ts:
        // after?: (user: User & Record<string, unknown>, context: GenericEndpointContext | null) => Promise<void>
        // `user` fields (id/email/name/image) sit directly on the object, matching the plan's
        // assumption. `isAnonymous` is not on the base `User` type (it's plugin-inferred), so it's
        // read defensively below. The anonymous plugin's default email generator
        // (dist/plugins/anonymous/index.mjs) always produces `temp@<id>.com` — never null/empty —
        // but the fallback below is kept in case a future version or custom config changes that.
        after: async (betterAuthUser) => {
          await db.insert(users).values({
            id: betterAuthUser.id,
            email:
              betterAuthUser.email || `${betterAuthUser.id}@anonymous.local`,
            anonymous: Boolean(
              (betterAuthUser as { isAnonymous?: boolean }).isAnonymous
            ),
            displayName: betterAuthUser.name,
            profileImage: betterAuthUser.image ?? null,
          })
        },
      },
    },
  },
})
