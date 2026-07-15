import "server-only"
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
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error(
    "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required"
  )
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
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
