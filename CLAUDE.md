# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Zola — open-source, multi-model AI chat interface (Next.js 16 App Router, React 19, TypeScript, Tailwind v4 + shadcn/ui). Supports 100+ models via the models.dev API, BYOK (bring-your-own-key) with AES-256-GCM encrypted storage, local Ollama models, MCP servers, and a self-hosted Postgres + Better Auth stack for auth/persistence.

## Commands

```bash
npm run dev          # start dev server (Turbopack)
npm run build         # production build (webpack, NOT turbopack)
npm run start         # run production build
npm run lint          # eslint .
npm run type-check    # tsc --noEmit
npm run analyze        # ANALYZE=true next build (bundle analyzer)
```

There is no test suite/runner configured in this repo (no `test` script, no test framework in devDependencies). CI (`.github/workflows/ci-cd.yml`) only runs lint, type-check, and build — a "Run Tests" step exists but is commented out. Don't assume Jest/Vitest exist; check before adding test tooling.

Required env vars for local dev live in `.env.example`; full setup (Postgres schema, Google OAuth, guest mode, encryption key generation, storage buckets) is documented in `INSTALL.md`. Two env vars are load-bearing at import time and will throw if missing/malformed: `ENCRYPTION_KEY` (must be a 32-byte value, base64-encoded) in `lib/encryption.ts`, and CSRF secret used by `lib/csrf.ts`.

## Architecture

### Request flow / middleware

`proxy.ts` is the Next.js middleware entry (via `config.matcher`). On every request it: enforces CSRF validation on state-changing methods (POST/PUT/DELETE) by comparing the `csrf_token` cookie against the `x-csrf-token` header (`lib/csrf.ts`, exempting Better Auth's own `/api/auth/*` routes which ship their own CSRF/origin protection), and sets a CSP header (dev vs prod policies differ — dev allows more relaxed script sources). Session handling is Better Auth's own cookie-based session, managed on each auth API call — there is no separate per-request session-refresh middleware step. The client bootstraps its CSRF cookie by hitting `GET /api/csrf` on mount (`app/layout-client.tsx`).

### Provider nesting (app/layout.tsx)

Global state is composed as nested React context providers in a fixed order — when adding a new global store, decide where it belongs in this chain (it may depend on `UserProvider` for `userId`, etc.):

```
TanstackQueryProvider > UserProvider > ModelProvider > MCPProvider > ChatsProvider
  > ChatSessionProvider > UserPreferencesProvider > BudgetProvider > Tooltip/Theme/Sidebar
```

Each store lives under `lib/<name>-store/` (or `lib/chat-store/<name>/`) with a `provider.tsx` (React context + hooks) and often an `api.ts` (fetch calls to Next.js API routes, which query Postgres via Drizzle server-side). Examples: `lib/model-store`, `lib/mcp-store`, `lib/user-store`, `lib/user-preference-store`, `lib/budget-store`, `lib/chat-store/{chats,messages,session}`.

### Local-first chat persistence

Chats/messages are cached client-side in IndexedDB (`lib/chat-store/persist.ts`, db name `zola-db`) and synced to the self-hosted Postgres backend through Next.js API routes (`app/api/chats/*`) — this is a local-first cache, not just a fetch cache; there is no browser-to-database client. `DB_VERSION` bumps trigger a full delete+recreate of the IndexedDB database; if you change the object store shape, bump `DB_VERSION` and understand old local data is discarded, not migrated.

### Model registry (models.dev-backed, dynamic)

There is no static hardcoded model list. `lib/models/index.ts` fetches the full model catalog from the models.dev API (`lib/models/remote.ts`) and caches it in-process for 5 minutes (`getAllModels`). Custom user-defined models (`lib/models/custom.ts`, backed by `app/api/custom-models`) are merged in on top of the cached remote list, not baked into the cache itself — this is deliberate so custom models don't pollute the shared cache across users. Provider display metadata (icons, ordering) lives separately in `lib/providers/` (`registry.ts` for priority/ordering, `index.ts` for the icon map) and only needs updating for cosmetic reasons; adding a new provider's models does not require touching this repo — see `README.md`'s "Contributing to models.dev" section.

### API keys (BYOK)

Two paths to get a provider API key at request time (`app/api/chat/route.ts`): (1) user-stored key, encrypted at rest via `lib/encryption.ts` (AES-256-GCM) and decrypted through `lib/user-keys.ts` (`getEffectiveApiKey` / `getUserKey`), scoped per `userId`+`provider` in the `user_keys` table (Drizzle, `lib/db/schema.ts`); (2) `ollama` provider never uses a stored key. There is intentionally no server-side env-var fallback for user API keys — `getEffectiveApiKey` only reads from the database.

### Chat route (`app/api/chat/route.ts`)

Single POST endpoint handles: usage/budget validation (`validateAndTrackUsage`), message logging, dynamic model+key resolution (above), MCP tool assembly (`lib/mcp/tools.ts` — supports both per-request server configs passed from the client and env-var fallback `MCP_URL`), then streams via Vercel AI SDK's `streamText`. Errors are normalized through `createErrorResponse`/`extractErrorMessage` in the sibling `utils.ts`.

### Database & Auth (Postgres + Drizzle + Better Auth)

The app runs against a self-hosted Postgres instance — no managed backend. `lib/db/schema.ts` defines the 13 app tables (chats, messages, projects, user_keys, etc.) via Drizzle ORM; `lib/db/auth-schema.ts` defines Better Auth's own tables (`user`, `session`, `account`, `verification`), sharing the same database. `lib/db/client.ts` exports the single `db` Drizzle instance every server-side module imports — there is no per-request or browser-side database client. Schema changes: edit `lib/db/schema.ts`/`lib/db/auth-schema.ts`, then `npm run db:generate` (drizzle-kit generates a migration under `lib/db/migrations/`) and `npm run db:migrate` to apply it.

Auth is Better Auth (`lib/auth.ts` server instance, `lib/auth-client.ts` browser client), configured with Google OAuth and the `anonymous()` plugin for guest sessions. `app/api/auth/[...all]/route.ts` is Better Auth's catch-all route handler. A `databaseHooks.user.create.after` hook keeps the app's own `users` profile table in sync whenever Better Auth creates a user (OAuth sign-in or anonymous guest); `onLinkAccount` reassigns a guest's data (`lib/db/reassign-user.ts`) when they later sign in with Google. Session reads use `auth.api.getSession({ headers })` server-side and `authClient`/`useSession()` client-side — there is no `isSupabaseEnabled`-style graceful degradation; Postgres and Better Auth are hard requirements for this app to run.

Authorization is enforced entirely at the application layer: every query filters explicitly by the authenticated user's id (`eq(table.userId, session.user.id)`), matching the pattern in every `app/api/*/route.ts` handler. There is no Postgres RLS.

File attachments are stored in MinIO (S3-compatible, `lib/storage/client.ts`), not Postgres — uploads go through `app/api/upload/route.ts`; the browser never talks to storage directly.

Self-hosting: `docker-compose.yml` provisions `postgres` and `minio` alongside the app. See `INSTALL.md` for full setup (env vars, Google OAuth app configuration, running migrations).

### Path aliases & UI conventions

`@/*` maps to repo root (tsconfig). shadcn/ui config (`components.json`) uses the "new-york" style, Tailwind v4 with CSS variables, no prefix; generated primitives go in `components/ui`. Other component groups: `components/prompt-kit` (chat-specific UI), `components/animate-ui` + `components/motion-primitives` (animation wrappers), `components/common` (shared composed widgets like model selectors).

### Formatting

Prettier (no semicolons, double quotes, `es5` trailing commas) with `@ianvs/prettier-plugin-sort-imports` and `prettier-plugin-tailwindcss` — import order and Tailwind class order are auto-sorted, don't hand-order them.
