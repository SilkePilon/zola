# Dependency Update (Phase A of 2)

Part of a two-phase effort: (A) update all npm packages and fix breaking changes,
(B) migrate off Supabase to self-hosted Postgres + a modern self-hosted auth
library. This spec covers Phase A only. Phase B is a separate spec written
after Phase A ships.

## Goal

Bring every dependency in `package.json` to its latest stable release and
update application code for any breaking changes introduced along the way,
without changing product behavior.

## Scope

All dependencies and devDependencies in `package.json`. Notable jumps
identified via `npx npm-check-updates`:

- **Next.js**: `15.4.0-canary.47` → `16.2.x`, plus `eslint-config-next`,
  `@next/bundle-analyzer` to match.
- **ESLint**: `9` → `10`.
- **AI SDK**: `ai` `5.0.88` → `7.0.x`, and all 15 `@ai-sdk/*` provider
  packages (anthropic, openai, google, groq, mistral, cohere, deepseek,
  fireworks, deepinfra, cerebras, baseten, togetherai, vercel, xai, perplexity,
  mcp, react) to their matching majors. This is the highest-risk jump — it
  touches `app/api/chat/route.ts`, `use-chat-core.ts`, `use-multi-chat.ts`,
  `conversation.tsx`, `message.tsx`, `message-assistant.tsx`, `get-sources.ts`,
  `multi-conversation.tsx`, `multi-chat.tsx`, `project-view.tsx`,
  `article.tsx`, `lib/chat-store/messages/api.ts`, `provider.tsx`, and
  `lib/mcp/tools.ts`.
- **lucide-react**: `0.503.0` → `1.24.0` (major version scheme change), 32
  files import from it.
- **recharts**: `2.15.4` → `3.9.x`.
- **react-day-picker**: `9.11.1` → `10.0.x`.
- **react-resizable-panels**: `3.0.6` → `4.12.x`.
- **shiki**: `3.4.0` → `4.3.x`.
- **marked**: `15.0.11` → `18.0.x`.
- **exa-js**: `1.6.13` → `2.16.x`.
- **@openrouter/ai-sdk-provider**: `1.2.0` → `3.0.x`.
- Everything else (Radix UI primitives, Tailwind CSS v4, Zod, Zustand,
  TanStack Query/Table, react-hook-form, framer-motion/motion, dompurify,
  date-fns, serwist, etc.) — minor/patch bumps, low risk.

## Explicitly out of scope

- **TypeScript `^5` → `^7`**: not upgrading. `typescript@7` has no stable
  release on npm yet (only nightly `-dev` builds as of 2026-07-14). Bump to
  the latest stable `5.x` instead.
- Any Supabase-related package changes beyond a routine version bump
  (`@supabase/ssr`) — the Supabase removal itself is Phase B.
- Package manager migration: repo has both a committed `package-lock.json`
  and a stale `packageManager: pnpm@10.15.1` field in `package.json`. CI
  (`.github/workflows/ci-cd.yml`) and `Dockerfile` both use `npm ci`, so npm
  is the actual package manager — the `pnpm` field will be removed, not
  acted on.

## Approach

Upgrade in risk order, verifying between each group so failures are easy to
isolate:

1. **Low-risk bulk bump** — everything except Next.js, AI SDK, and lucide.
   Run `type-check` + `build` after, fix any breakage.
2. **Next.js 15 → 16** — apply official codemods where available, resolve
   config/middleware/routing breaking changes, `type-check` + `build`.
3. **AI SDK v5 → v7** — migrate one logical unit at a time (server route,
   then `useChat`-based hooks, then message rendering, then MCP tool
   wiring), following the official AI SDK migration guides for each major
   version step (5→6, 6→7). `type-check` + `build` after each unit.
4. **lucide-react, recharts, react-day-picker, react-resizable-panels,
   shiki, marked, exa-js, @openrouter/ai-sdk-provider** — one at a time,
   `type-check` after each, since these are independent of each other.
5. Remove the stale `packageManager: pnpm` field from `package.json`.

## Testing

- `npm run type-check` and `npm run build` must pass after each group above.
- `npm run lint` clean.
- Manual smoke test in dev server (build/typecheck can't catch runtime
  streaming/UI behavior):
  - Send a chat message, confirm streaming response renders.
  - Trigger a tool call (MCP) and confirm it executes and renders.
  - Multi-chat / multi-model flow.
  - File attachment upload in chat input.
  - Charts (usage/cost dashboard using recharts).
  - Date picker (settings or wherever used).
  - Icon rendering spot-check (lucide-react) across a few pages.

## Non-goals

- No product/feature changes.
- No refactors beyond what's required to satisfy the new package APIs.
