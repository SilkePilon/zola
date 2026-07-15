# Self-hosted Postgres + Auth migration (moving off Supabase)

## Context

Zola currently uses Supabase for auth (Google OAuth + anonymous guest sessions), Postgres database access (raw `supabase-js` `.from()` calls, no ORM), file storage (one `chat-attachments` bucket), and one Realtime subscription (live-updating a user's profile row). Row Level Security is defined in `supabase/schema.sql` but the policies are commented out — authorization is already enforced entirely at the application layer (every API route calls `getUser()` then filters queries by `user_id`).

Goal: replace Supabase entirely with a self-hosted stack the user runs themselves via Docker Compose: Postgres + Drizzle ORM + Better Auth + MinIO (S3-compatible storage). This is a clean cutover — no existing production data to migrate.

Scope inventory (from codebase audit): 67 files reference Supabase, 40 import `lib/supabase`, 38 files issue `.from()` queries against 13 tables (`users`, `chats`, `messages`, `projects`, `user_keys`, `model_usage`, `mcp_servers`, `custom_models`, `budget_limits`, `budget_alerts`, `user_preferences`, `feedback`, `chat_attachments`).

## Decisions (locked in during brainstorming)

- **Auth library**: Better Auth. TS-native, first-class Drizzle adapter, built-in `anonymous()` plugin that maps directly onto the existing guest-mode flow (and additionally supports linking an anonymous session to a real account on later sign-in — a capability the current flow lacks).
- **ORM**: Drizzle.
- **Storage**: MinIO (S3-compatible), added as a docker-compose service. Code uses the S3 API (`@aws-sdk/client-s3`), so it stays portable to a real S3/R2 bucket later if desired.
- **Data migration**: none needed — clean cutover, no existing Supabase data to carry over.
- **Realtime**: dropped. The only usage (`subscribeToUserUpdates`, live-syncing a user's profile row across tabs) is low-value; removing it avoids standing up a new push-update layer for one field.
- **Docker Compose**: `postgres` and `minio` services are added to `docker-compose.yml` so `docker compose up` gives a complete self-hosted stack (app + db + storage) in one command.
- **DB requirement**: Postgres becomes a hard requirement. The current `isSupabaseEnabled`-gated graceful degradation (app boots with no persistence/auth if env vars are unset) is removed — self-hosted deployments always have Postgres available.

## Architecture

```
Browser
  │
  ▼
Next.js (proxy.ts middleware: CSRF + Better Auth session refresh)
  │
  ├─► Better Auth (lib/auth.ts) ──► Postgres (auth tables: user/session/account/verification)
  │
  ├─► App API routes ──► lib/db (Drizzle) ──► Postgres (app tables)
  │
  └─► lib/file-handling.ts ──► MinIO (S3 API) — chat-attachments bucket
```

Postgres is the single database, holding both Better Auth's own tables and the app's existing 13 tables side by side. Drizzle is the only query layer — no raw `supabase-js` calls remain anywhere.

## Components

### 1. Database layer (`lib/db/`)

- `lib/db/schema.ts` — Drizzle schema for the 13 existing app tables, translated 1:1 from `supabase/schema.sql` (same columns/types/defaults/indexes; drop Supabase-specific bits like `auth.uid()` defaults and the `auth` schema references).
- `lib/db/client.ts` — single exported `db` (Drizzle instance over a `node-postgres` `Pool`, driven by `DATABASE_URL`). Replaces `lib/supabase/client.ts`, `server.ts`, `server-guest.ts` as the one way to reach Postgres.
- `drizzle.config.ts` + `drizzle-kit` migrations directory — schema changes are authored in `schema.ts` and applied via `drizzle-kit generate` + `drizzle-kit migrate`, replacing manual `supabase/schema.sql` application.
- `supabase/schema.sql` is deleted once the Drizzle schema is confirmed equivalent.

### 2. Auth (`lib/auth.ts`, `lib/auth-client.ts`)

- `lib/auth.ts` — Better Auth server instance: Drizzle adapter pointed at `db`, Google OAuth provider (reusing the existing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` env vars), and the `anonymous()` plugin configured to auto-create a guest user on first visit, matching today's `getOrCreateGuestUserId` behavior.
- `lib/auth-client.ts` — Better Auth React client (`createAuthClient`) used by client components that today call `supabase.auth.*` (`app/auth/login-page.tsx`, `dialog-auth.tsx`, `popover-content-auth.tsx`).
- Replaces: `lib/supabase/client.ts`, `server.ts`, `server-guest.ts`, `utils/supabase/middleware.ts`, `app/auth/callback/route.ts` (Better Auth handles the OAuth callback route itself via its catch-all handler), `app/auth/login/actions.ts`, `app/api/create-guest/route.ts` (superseded by the anonymous plugin's own session creation — no separate profile-row insert step needed since the app `users` row concept collapses into Better Auth's `user` table, extended with the app-specific columns it needs via Better Auth's `additionalFields`).
- `proxy.ts` swaps its Supabase session-refresh call for Better Auth's session cookie handling; CSRF logic is untouched (independent of auth provider).
- All ~25 API-route call sites using `supabase.auth.getUser()` swap to `auth.api.getSession({ headers })`, reading `session.user.id` in place of the current `user.id`.

### 3. Call-site rewiring (the 38 `.from()` files)

Each existing store module keeps its current file location and exported function signatures — only internals change, so callers in components/routes need no changes. Concretely: `lib/chat-store/chats/api.ts`, `lib/chat-store/messages/api.ts`, `app/api/chat/db.ts`, `lib/budget.ts`, `lib/usage.ts`, `lib/mcp-store/supabase.ts` (renamed to reflect Drizzle), `lib/models/custom.ts`, `lib/server/api.ts`, and the various `app/api/*/route.ts` handlers all swap `supabase.from(table).select/insert/update/delete()` chains for equivalent Drizzle query-builder calls against `lib/db`. Authorization pattern is preserved as-is: every query still filters explicitly by the authenticated `userId`, since that's how authorization already worked (RLS was never enabled).

### 4. Storage (`lib/file-handling.ts`)

Swap `supabase.storage.from(bucket).upload()`/`.getPublicUrl()` for `@aws-sdk/client-s3`'s `PutObjectCommand` against MinIO, keeping the same key layout: today's code generates `uploads/{randomId}.{ext}` (see `lib/file-handling.ts:65-66`), unscoped by user id — carried over unchanged. Public read is served via a MinIO public bucket policy, matching today's `getPublicUrl()` behavior.

### 5. Docker Compose

`docker-compose.yml` gains `postgres` (official `postgres:16` image, named volume, healthcheck) and `minio` (official `minio/minio` image, named volume, healthcheck) services. The `zola` app service gets `depends_on` entries for both and new environment variables (`DATABASE_URL`, `MINIO_*` / S3 credentials).

## Data flow example (chat message send)

1. Client submits message → `app/api/chat/route.ts`.
2. Route calls `auth.api.getSession()` to resolve `userId` (replaces `supabase.auth.getUser()`).
3. Budget/usage validation queries Postgres via `lib/budget.ts` (Drizzle) instead of `supabase.from("budget_limits")`.
4. Message persisted via `lib/chat-store/messages/api.ts` (Drizzle insert), filtered/scoped by `userId` exactly as today.
5. Attachments (if any) already uploaded to MinIO via `lib/file-handling.ts`; only the resulting object key/URL is stored in the `messages`/`chat_attachments` row.

## Error handling

Drizzle throws on constraint violations / connection errors the same way `supabase-js` surfaced Postgres errors, just with a different error shape. `app/api/chat/utils.ts`'s `createErrorResponse`/`extractErrorMessage` normalization stays in place; only the code that inspects Supabase-specific error fields (if any) needs adjusting to Drizzle/`pg` error shapes (`error.code`, Postgres error codes like `23505` for unique violations remain identical since it's the same underlying Postgres).

## Testing

No test suite exists in this repo (confirmed in CLAUDE.md — lint/type-check/build only, no Jest/Vitest). Verification for this migration is manual, driven end-to-end after each phase:

- `docker compose up` brings up Postgres + MinIO + app cleanly.
- Google OAuth login flow completes and creates a session.
- Guest/anonymous flow creates a session without explicit sign-in.
- Chat create/send/list, project create/list, file upload/download all work and are scoped per-user (verified by checking a second account can't see the first's data).
- `npm run type-check` and `npm run build` pass with `@supabase/*` fully removed from `package.json`.

## Out of scope

- Migrating existing Supabase production data (none exists per user).
- Preserving Realtime cross-tab profile sync (explicitly dropped).
- Preserving the no-DB graceful-degradation mode (explicitly dropped — Postgres is now required).
- Any change to the encryption-at-rest scheme for user API keys (`lib/encryption.ts` is unaffected — it wraps values before they're stored, independent of which DB layer stores them).
