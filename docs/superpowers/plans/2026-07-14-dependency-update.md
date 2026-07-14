# Dependency Update (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every dependency in `package.json` to its latest stable release and fix all resulting breakage, with zero product-behavior change.

**Architecture:** Sequential, risk-ordered bumps. Each task: bump version(s) → `npm install` → `npm run type-check` → fix whatever the compiler *actually* reports → `npm run build` → fix whatever *that* actually reports → manual smoke check where noted → commit. Research below lists the breaking changes we expect from each package's changelog/migration guide, but **the compiler and build output are the source of truth, not this document** — if a real error doesn't match the expected diff, follow the error, not the snippet.

**Tech Stack:** Next.js, React 19, TypeScript, Vercel AI SDK, npm.

## Global Constraints

- Package manager is **npm** (confirmed via `.github/workflows/ci-cd.yml` and `Dockerfile`, both use `npm ci`) — never introduce pnpm/yarn commands.
- `typescript` stays on latest **`5.x`** — do not bump to `^7`, which has no stable npm release as of 2026-07-14 (only `-dev` nightly builds).
- Node floor moves to **20** (required by shiki v4 and marked v16+) — update `.github/workflows/ci-cd.yml` (both `node-version: "18"` occurrences) and `Dockerfile` (`FROM node:18-alpine`) to Node 20.
- `@supabase/ssr` stays pinned at its current version (`^0.5.2`) this phase — the Supabase integration is deleted wholesale in Phase B, so upgrading it now is wasted work. Do not touch it.
- `exa-js` and `@openrouter/ai-sdk-provider` are removed from `package.json` — both confirmed unused anywhere in the codebase (verified via repo-wide grep for imports/usages of each). Removing avoids dragging in a Node ≥22 floor for `@openrouter/ai-sdk-provider@3` that nothing needs.
- No product/feature changes. No refactors beyond what each package's new API requires.
- After every task: `npm run type-check` and `npm run build` must both exit 0 before moving to the next task.

---

### Task 1: Remove unused deps, raise Node floor

**Files:**
- Modify: `package.json` (remove `exa-js`, `@openrouter/ai-sdk-provider` from `dependencies`)
- Modify: `.github/workflows/ci-cd.yml:24` and `:53` (`node-version: "18"` → `"20"`)
- Modify: `Dockerfile:2` (`FROM node:18-alpine AS base` → `FROM node:20-alpine AS base`)

**Interfaces:** N/A — infrastructure-only task, nothing downstream depends on these files' internals.

- [ ] **Step 1: Confirm both packages are truly unused**

```bash
grep -rn "exa-js\|from \"exa\|from 'exa" --include="*.ts" --include="*.tsx" . | grep -v node_modules
grep -rn "@openrouter/ai-sdk-provider\|createOpenRouter" --include="*.ts" --include="*.tsx" . | grep -v node_modules
```
Expected: no output from either command. If either produces a match, stop and keep that package (bump it instead of removing — re-scope this task before continuing).

- [ ] **Step 2: Remove the two packages**

```bash
npm uninstall exa-js @openrouter/ai-sdk-provider
```

- [ ] **Step 3: Bump Node floor in CI and Docker**

In `.github/workflows/ci-cd.yml`, change both occurrences:
```diff
       - name: Setup Node.js
         uses: actions/setup-node@v4
         with:
-          node-version: "18"
+          node-version: "20"
           cache: "npm"
```

In `Dockerfile`:
```diff
-FROM node:18-alpine AS base
+FROM node:20-alpine AS base
```

- [ ] **Step 4: Verify**

```bash
npm run type-check
npm run build
```
Expected: both exit 0 (this task doesn't touch any code that should change compiler output).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .github/workflows/ci-cd.yml Dockerfile
git commit -m "chore: drop unused exa-js/openrouter deps, raise Node floor to 20"
```

---

### Task 2: Low-risk bulk bump

**Files:**
- Modify: `package.json` (version bumps only)
- Modify: any file `type-check`/`build` flags as broken by this group

**Interfaces:** N/A.

Everything **except**: `next`, `eslint`, `eslint-config-next`, `@next/bundle-analyzer`, `ai` + all `@ai-sdk/*`, `lucide-react`, `recharts`, `react-day-picker`, `react-resizable-panels`, `shiki`, `marked`, `typescript`, `@supabase/ssr`. This still covers: Radix UI primitives, Tailwind CSS v4 + plugins, Zod, Zustand, TanStack Query/Table, react-hook-form, framer-motion/motion, dompurify, date-fns, serwist/@serwist/next, `@modelcontextprotocol/sdk`, `file-type`, `jsdom`, `@types/node`, `@types/jsdom`, `@types/react-window`, prettier + plugins, and the rest of the low-risk list from the spec.

- [ ] **Step 1: Bump the group**

```bash
npx npm-check-updates -u -x next,eslint,eslint-config-next,@next/bundle-analyzer,ai,'/^@ai-sdk\//',lucide-react,recharts,react-day-picker,react-resizable-panels,shiki,marked,typescript,@supabase/ssr
npm install
```

- [ ] **Step 2: Type-check and read the errors**

```bash
npm run type-check
```
Two files are flagged as real risk by prior research and need attention regardless of what the compiler says elsewhere:

- `lib/file-handling.ts` — uses `fileType.fileTypeFromBuffer(...)` from `file-type` (bumping 20.x→22.x). `file-type` has a history of changing its detection API shape across majors; if `type-check` or `build` flags this call, check the installed package's `.d.ts` (`node_modules/file-type/index.d.ts`) for the current `fileTypeFromBuffer` signature and adjust the call/import accordingly.
- `lib/sanitize.ts` — uses `new JSDOM("")` from `jsdom` (bumping 26.x→29.x). If flagged, check `node_modules/jsdom/lib/api.js`'s exported shape hasn't changed the `JSDOM` constructor signature used here.

For every other error surfaced, fix it against the actual compiler message — these are genuinely lower-risk packages with no anticipated breaking changes for this codebase's usage, so most of this bump should type-check clean.

- [ ] **Step 3: Build**

```bash
npm run build
```
Fix any runtime/build-time errors surfaced (e.g. serwist/PWA build step, Tailwind plugin resolution).

- [ ] **Step 4: Manual smoke test**

Start `npm run dev`, confirm the app loads and file upload in chat input still works (exercises the `file-type` bump directly).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json <any fixed files>
git commit -m "chore: bulk-bump low-risk dependencies"
```

---

### Task 3: Next.js 15 → 16 + ESLint 9 → 10

**Files:**
- Modify: `package.json` (`next`, `eslint`, `eslint-config-next`, `@next/bundle-analyzer`)
- Modify: `next.config.ts`
- Modify: `eslint.config.mjs`
- Modify: `middleware.ts` (rename to `proxy.ts` — conditional, see Step 5)
- Modify: `package.json` scripts (`lint`, `dev`)

**Interfaces:** N/A — this task's output is "the app still builds, lints, and serves requests through whatever file now handles request interception."

- [ ] **Step 1: Bump packages**

```bash
npm install next@16 eslint@10 eslint-config-next@16 @next/bundle-analyzer@16
```

- [ ] **Step 2: Fix `next.config.ts`**

Remove the now-invalid `eslint.ignoreDuringBuilds` option (`next build` no longer lints, `next lint` was removed in Next 16):
```diff
   eslint: {
-    // @todo: remove before going live
-    ignoreDuringBuilds: true,
-  },
```

Turbopack is the default bundler for both `next dev` and `next build` in Next 16; a `next build` with a custom `webpack()` callback fails outright. Replace the manual `webpack-bundle-analyzer` wiring with the official `@next/bundle-analyzer` wrapper, and only invoke it with `--webpack` explicitly:
```diff
 import type { NextConfig } from "next"
-import type { Configuration } from "webpack"
+import withBundleAnalyzer from "@next/bundle-analyzer"
 import withSerwistInit from "@serwist/next"

 const withSerwist = withSerwistInit({
   swSrc: "app/sw.ts",
   swDest: "public/sw.js",
   cacheOnNavigation: true,
   reloadOnOnline: true,
   disable: process.env.NODE_ENV === "development",
 })

+const withAnalyzer = withBundleAnalyzer({
+  enabled: process.env.ANALYZE === "true",
+})
+
 const nextConfig: NextConfig = {
   output: "standalone",
   experimental: {
     optimizePackageImports: ["@phosphor-icons/react"],
   },
   serverExternalPackages: [
     "shiki",
-    "vscode-oniguruma",
     "@ai-sdk/baseten",
     "@basetenlabs/performance-client",
     "@basetenlabs/performance-client-linux-x64-gnu",
     "@basetenlabs/performance-client-linux-x64-musl",
   ],
   images: {
     remotePatterns: [
       {
         protocol: "https",
         hostname: "*.supabase.co",
         port: "",
         pathname: "/storage/v1/object/public/**",
       },
     ],
   },
-  eslint: {
-    // @todo: remove before going live
-    ignoreDuringBuilds: true,
-  },
-  // Bundle analyzer for Webpack (only used in production builds)
-  ...(process.env.ANALYZE === "true" &&
-  process.env.NODE_ENV !== "development"
-    ? {
-        webpack: (config: Configuration) => {
-          const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer")
-          if (!config.plugins) {
-            config.plugins = []
-          }
-          config.plugins.push(
-            new BundleAnalyzerPlugin({
-              analyzerMode: "static",
-              openAnalyzer: false,
-            })
-          )
-          return config
-        },
-      }
-    : {}),
 }

-export default withSerwist(nextConfig)
+export default withSerwist(withAnalyzer(nextConfig))
```
(`vscode-oniguruma` is removed from `serverExternalPackages` — confirmed via `package-lock.json` that shiki does not depend on a package by that name; it was already a stale no-op entry. Modern shiki bundles its oniguruma engine as `@shikijs/engine-oniguruma`.)

Add an `analyze` script to `package.json` matching the `--webpack` opt-back-in pattern:
```diff
   "scripts": {
     "dev": "next dev --turbopack",
     "build": "next build",
     "start": "next start",
     "lint": "next lint",
-    "type-check": "tsc --noEmit"
+    "type-check": "tsc --noEmit",
+    "analyze": "ANALYZE=true next build --webpack"
   },
```

- [ ] **Step 3: Fix the `lint` script (`next lint` is removed in Next 16)**

```diff
-    "lint": "next lint",
+    "lint": "eslint .",
```
Also simplify `dev` since `--turbopack` is now the default and the flag is redundant (harmless either way, but matches the documented migration):
```diff
-    "dev": "next dev --turbopack",
+    "dev": "next dev",
```

- [ ] **Step 4: Migrate `eslint.config.mjs` to native flat config**

```diff
-import { dirname } from "path"
-import { fileURLToPath } from "url"
-import { FlatCompat } from "@eslint/eslintrc"
-
-const __filename = fileURLToPath(import.meta.url)
-const __dirname = dirname(__filename)
-
-const compat = new FlatCompat({
-  baseDirectory: __dirname,
-})
-
-const eslintConfig = [
-  ...compat.extends("next/core-web-vitals", "next/typescript"),
-]
+import { defineConfig, globalIgnores } from "eslint/config"
+import nextVitals from "eslint-config-next/core-web-vitals"
+import nextTs from "eslint-config-next/typescript"
+
+const eslintConfig = defineConfig([
+  ...nextVitals,
+  ...nextTs,
+  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
+])

 export default eslintConfig
```
If `eslint-config-next@16` doesn't actually export `core-web-vitals`/`typescript` as ESM subpaths with this exact shape, `npm run lint` will throw an import error — check `node_modules/eslint-config-next/package.json`'s `exports` field for the real subpath names and adjust the two import lines accordingly. Once this works, `@eslint/eslintrc` is no longer needed:
```bash
npm uninstall @eslint/eslintrc
```
(only if nothing else in the repo imports it — check with `grep -rn "@eslint/eslintrc" --include="*.ts" --include="*.mjs" . | grep -v node_modules` first).

- [ ] **Step 5: Verify and conditionally rename `middleware.ts` → `proxy.ts`**

Run `npm run dev`, then check the terminal output for a deprecation warning about `middleware.ts`. Separately, send a state-changing request without a CSRF header and confirm it's still rejected with 403 (this exercises the exact logic that a silently-ignored middleware file would break):
```bash
curl -i -X POST http://localhost:3000/api/create-guest
```
Expected: `403` (or whatever status `validateCsrfToken` currently returns) — NOT a 200 that reached the handler.

If the dev server logs a deprecation warning (or if CSRF protection stops firing), migrate the file:
```diff
-export async function middleware(request: NextRequest) {
+export async function proxy(request: NextRequest) {
   const response = await updateSession(request)
   ...
 }

 export const config = {
   matcher: [
     "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
   ],
-  runtime: "nodejs",
 }
```
and rename the file:
```bash
git mv middleware.ts proxy.ts
```
Re-run the same `curl` check above after the rename to confirm CSRF protection still fires. If the dev server does NOT warn and CSRF still works with the file named `middleware.ts`, leave it as-is — don't rename speculatively.

- [ ] **Step 6: Type-check and build**

```bash
npm run type-check
npm run build
```
Fix whatever the compiler/build actually report. `app/**` route files were pre-verified (during planning) to already use the async `params`/`searchParams` pattern Next 16 requires, so no route-handler changes are anticipated — but trust the build output over this note if it disagrees.

- [ ] **Step 7: Lint**

```bash
npm run lint
```
Fix real findings; ESLint 10 turns on JSX-reference tracking by default which can surface previously-hidden `no-unused-vars` issues.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: upgrade Next.js to 16, ESLint to 10, migrate config/scripts"
```

---

### Task 4: AI SDK v5 → v7 — server route + provider types

**Files:**
- Modify: `package.json` (`ai` and all 15 `@ai-sdk/*` packages)
- Modify: `app/api/chat/route.ts`
- Modify: `lib/models/types.ts`
- Modify: `app/api/mcp/tools/route.ts`, `app/api/mcp/test/route.ts` (conditional, see Step 4)

**Interfaces:**
- Produces: `lib/models/types.ts`'s `ModelConfig.apiSdk` return type changes from `Promise<LanguageModelV2>` to whatever the installed `@ai-sdk/provider` actually exports (expected `LanguageModelV4`, confirm against `node_modules/@ai-sdk/provider/dist/index.d.ts`) — Task 6 (`lib/models/sdk.ts` consumers, if `type-check` flags any) relies on this being fixed first.

- [ ] **Step 1: Bump `ai` and every `@ai-sdk/*` package together**

```bash
npm install ai@7 @ai-sdk/anthropic@4 @ai-sdk/baseten@2 @ai-sdk/cerebras@3 @ai-sdk/cohere@4 @ai-sdk/deepinfra@3 @ai-sdk/deepseek@3 @ai-sdk/fireworks@3 @ai-sdk/google@4 @ai-sdk/groq@4 @ai-sdk/mcp@2 @ai-sdk/mistral@4 @ai-sdk/openai@4 @ai-sdk/perplexity@4 @ai-sdk/react@4 @ai-sdk/togetherai@3 @ai-sdk/vercel@3 @ai-sdk/xai@4
```
(These majors are what's on npm as latest today; if `npm install` resolves different majors due to peer-dependency constraints, accept what npm resolves — it knows the real compatibility matrix better than this plan.)

- [ ] **Step 2: Type-check and fix `lib/models/types.ts`**

```bash
npm run type-check
```
Expected error: `LanguageModelV2` no longer exported (or no longer assignable) from `@ai-sdk/provider`. Check what the installed package actually exports:
```bash
grep -n "LanguageModelV" node_modules/@ai-sdk/provider/dist/index.d.ts | head -5
```
Update the import and every usage in `lib/models/types.ts` to match (expected: rename to `LanguageModelV4`):
```diff
-import { LanguageModelV2 } from '@ai-sdk/provider'
+import { LanguageModelV4 } from '@ai-sdk/provider'
```
and wherever `LanguageModelV2` appears later in the same file's `apiSdk` field type, rename it to match.

- [ ] **Step 3: Fix `app/api/chat/route.ts`**

Re-run `type-check` after Step 2's fix and address whatever it reports in this file. Expected breaks, per the AI SDK v6/v7 migration guides:

a) `stepCountIs` renamed:
```diff
-import { streamText, ToolSet, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
+import { streamText, ToolSet, isStepCount, convertToModelMessages, type UIMessage } from "ai";
```
```diff
-        stopWhen: stepCountIs(10),
+        stopWhen: isStepCount(10),
```

b) `convertToModelMessages` is now async:
```diff
-    const modelMessages = convertToModelMessages(messages)
+    const modelMessages = await convertToModelMessages(messages)
```

c) `system` renamed to `instructions` on `streamText`'s options:
```diff
       const streamTextOptions: Parameters<typeof streamText>[0] = {
         model: modelInstance,
-        system: effectiveSystemPrompt,
+        instructions: effectiveSystemPrompt,
         messages: modelMessages,
```

If the compiler reports something different from (a)/(b)/(c) — e.g. `stepCountIs` still exists, or `system` still type-checks — leave that particular spot alone; only apply the diff that matches a real compiler error. Do **not** touch `result.toUIMessageStreamResponse({...})` — it is confirmed still present and functional on the v7 result object (deprecated but working; a rewrite to the new `toUIMessageStream`/`createUIMessageStreamResponse` helpers is out of scope for this phase since the new helpers' exact option surface for `sendReasoning`/`sendSources`/`onError`/`messageMetadata` isn't confirmed compatible — don't risk silently dropping that behavior for a non-required cleanup).

- [ ] **Step 4: Check MCP transport `redirect` behavior**

`@ai-sdk/mcp`'s `MCPTransportConfig` changed its default `redirect` behavior to `'error'` (SSRF hardening) as of the v7-line release. `app/api/mcp/tools/route.ts` and `app/api/mcp/test/route.ts` both call `experimental_createMCPClient({ transport: { type, url, headers } })` without an explicit `redirect` option. This is a behavior check, not necessarily a code change:

Manually test against an MCP server known to redirect (if none is available, skip this check and note it in the commit message as unverified). If a previously-working MCP server connection now fails specifically because of a redirect, add `redirect: 'follow'` to both transport objects to restore prior behavior:
```diff
       return await experimental_createMCPClient({
         transport: {
           type: 'http',
           url: config.url,
           headers,
+          redirect: 'follow',
         },
       })
```
(apply the same to the `sse` case in both files). If no redirect-related failures are observed, leave both files unchanged — the new default is a legitimate security hardening and shouldn't be silently reverted without evidence it's needed.

- [ ] **Step 5: Type-check and build**

```bash
npm run type-check
npm run build
```
Fix whatever's actually reported, in any of the other 13 files touching `ai`/`@ai-sdk/react` (`use-chat-core.ts`, `use-multi-chat.ts`, `conversation.tsx`, `message.tsx`, `message-assistant.tsx`, `get-sources.ts`, `project-view.tsx`, `article.tsx`, `multi-conversation.tsx`, `multi-chat.tsx`, `lib/chat-store/messages/api.ts`, `provider.tsx`, `lib/mcp/tools.ts`) — prior research found these all type against `UIMessage`/`ToolSet`/`useChat()`'s return shape, none of which changed across v5→v7, so no changes are anticipated here, but trust the compiler.

- [ ] **Step 6: Manual smoke test**

`npm run dev`, then:
- Send a chat message, confirm the response streams in.
- Trigger an MCP tool call (if a test MCP server is configured) and confirm it executes and renders.
- Use the multi-chat / multi-model view and confirm both streams work.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: upgrade AI SDK (ai + all @ai-sdk/* providers) to v7"
```

---

### Task 5: lucide-react 0.503 → 1.24

**Files:**
- Modify: `package.json`

**Interfaces:** N/A.

- [ ] **Step 1: Bump**

```bash
npm install lucide-react@1
```

- [ ] **Step 2: Type-check and build**

```bash
npm run type-check
npm run build
```
No breaks are anticipated — this repo's 32 icon-importing files were checked against lucide's v1 removed-icons list (brand icons: Chromium, Codepen, Codesandbox, Dribbble, Facebook, Figma, Framer, Github, Gitlab, Instagram, LinkedIn, Pocket, RailSymbol, Slack) and none of the icons in use (`AlertCircle`, `AlertTriangle`, `ArrowLeft`, `ArrowRight`, `ArrowUpDown`, `Check`, `CheckIcon`, `ChevronDown`, `ChevronDownIcon`, `ChevronRight`, `ChevronRightIcon`, `ChevronLeftIcon`, `ChevronsUpDown`, `CircleIcon`, `DollarSign`, `GripVerticalIcon`, `Loader2`, `Loader2Icon`, `MinusIcon`, `MoreHorizontal`, `PanelLeftIcon`, `Pencil`, `Pin`, `PinOff`, `Power`, `PowerOff`, `Quote`, `RefreshCw`, `Server`, `Trash2`, `X`, `XIcon`) overlap that list. If the compiler/build disagrees, fix the specific import that broke.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade lucide-react to v1"
```

---

### Task 6: recharts 2 → 3

**Files:**
- Modify: `package.json`
- Modify: `components/ui/chart.tsx`

**Interfaces:** N/A — this is a leaf UI component.

- [ ] **Step 1: Bump**

```bash
npm install recharts@3
```

- [ ] **Step 2: Type-check and fix `components/ui/chart.tsx`**

```bash
npm run type-check
```
Expected errors and fixes, in `ChartTooltipContent`'s prop type:
```diff
 import * as RechartsPrimitive from "recharts"
+import type { TooltipValueType } from "recharts"
+
+type TooltipNameType = number | string

 function ChartTooltipContent({
   active,
   payload,
   className,
   indicator = "dot",
   hideLabel = false,
   hideIndicator = false,
   label,
   labelFormatter,
   labelClassName,
   formatter,
   color,
   nameKey,
   labelKey,
 }: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
   React.ComponentProps<"div"> & {
     hideLabel?: boolean
     hideIndicator?: boolean
     indicator?: "line" | "dot" | "dashed"
     nameKey?: string
     labelKey?: string
-  }) {
+  } & Omit<
+    RechartsPrimitive.DefaultTooltipContentProps<TooltipValueType, TooltipNameType>,
+    "accessibilityLayer"
+  >) {
```

In the same component's render, guard against non-numeric tooltip values (recharts v3's payload value type widened from effectively-always-number to `string | number | Array<string | number>`):
```diff
-                {item.value && (
+                {item.value != null && (
                   <span className="text-foreground font-mono font-medium tabular-nums">
-                    {item.value.toLocaleString()}
+                    {typeof item.value === "number"
+                      ? item.value.toLocaleString()
+                      : String(item.value)}
                   </span>
                 )}
```
And make the adjacent `payload.fill` access optional-safe:
```diff
-                  backgroundColor: item.payload.fill || item.color,
+                  backgroundColor: item.payload?.fill || item.color,
```
(match this to whatever the actual surrounding line looks like — find it with `grep -n "payload.fill" components/ui/chart.tsx`.)

In `ChartLegendContent`'s prop type:
```diff
 function ChartLegendContent({
   className,
   hideIcon = false,
   payload,
   verticalAlign = "bottom",
   nameKey,
 }: React.ComponentProps<"div"> &
-  Pick<RechartsPrimitive.LegendProps, "payload" | "verticalAlign"> & {
+  {
     hideIcon?: boolean
     nameKey?: string
-  }) {
+  } & RechartsPrimitive.DefaultLegendContentProps) {
```

If any of these named types (`DefaultTooltipContentProps`, `DefaultLegendContentProps`, `TooltipValueType`) don't exist in the installed `recharts@3` version, run `grep -n "DefaultTooltipContentProps\|DefaultLegendContentProps\|TooltipValueType" node_modules/recharts/types/index.d.ts` to find the actual exported names and use those instead.

- [ ] **Step 3: Build and manual smoke test**

```bash
npm run build
```
`npm run dev`, navigate to the usage/cost dashboard (uses `components/ui/chart.tsx`), confirm charts render with correct tooltip/legend content.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json components/ui/chart.tsx
git commit -m "chore: upgrade recharts to v3, fix chart.tsx types"
```

---

### Task 7: react-day-picker 9 → 10

**Files:**
- Modify: `package.json`

**Interfaces:** N/A.

- [ ] **Step 1: Bump**

```bash
npm install react-day-picker@10
```

- [ ] **Step 2: Type-check and build**

```bash
npm run type-check
npm run build
```
`components/ui/calendar.tsx` was checked against react-day-picker v10's removed-props list (`fromMonth`/`fromYear`/`toMonth`/`toYear`/`fromDate`/`toDate`, `initialFocus`, `onWeekNumberClick`/`onDayKeyUp`/etc., `formatMonthCaption`/`formatYearCaption`, `labelDay`/`labelCaption`, `isMatch`/`isDateInRange`, `components.Button`) — it uses none of these (it uses `formatMonthDropdown`, `getDefaultClassNames()`, `components: { Root, Chevron, DayButton, WeekNumber }`, none of which were removed), so no changes are anticipated. If the compiler/build disagrees, fix the specific prop it flags in `components/ui/calendar.tsx`.

- [ ] **Step 3: Manual smoke test**

`npm run dev`, open any date picker in the app (check settings/budget-limits UI), confirm it renders and date selection works.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade react-day-picker to v10"
```

---

### Task 8: react-resizable-panels 3 → 4

**Files:**
- Modify: `package.json`
- Modify: `components/ui/resizable.tsx`

**Interfaces:** N/A — leaf UI component.

- [ ] **Step 1: Bump**

```bash
npm install react-resizable-panels@4
```

- [ ] **Step 2: Rewrite `components/ui/resizable.tsx`**

```tsx
"use client"

import { GripVerticalIcon } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

function ResizablePanelGroup({
  className,
  ...props
}: ResizablePrimitive.GroupProps) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      className={cn(
        "flex h-full w-full aria-[orientation=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ResizablePanel({ ...props }: ResizablePrimitive.PanelProps) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />
}

function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizablePrimitive.SeparatorProps & {
  withHandle?: boolean
}) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden aria-[orientation=horizontal]:h-px aria-[orientation=horizontal]:w-full aria-[orientation=horizontal]:after:left-0 aria-[orientation=horizontal]:after:h-1 aria-[orientation=horizontal]:after:w-full aria-[orientation=horizontal]:after:translate-x-0 aria-[orientation=horizontal]:after:-translate-y-1/2 [&[aria-orientation=horizontal]>div]:rotate-90",
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
          <GripVerticalIcon className="size-2.5" />
        </div>
      )}
    </ResizablePrimitive.Separator>
  )
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup }
```
This applies three renames (`PanelGroup`→`Group`, `PanelResizeHandle`→`Separator`, prop types now come from `ResizablePrimitive.GroupProps`/`PanelProps`/`SeparatorProps` instead of `React.ComponentProps<typeof X>`) and swaps the `data-panel-group-direction` CSS attribute selectors for `aria-orientation` ones, since v4 no longer sets the old attribute. If `type-check` reports a different export name than `Group`/`Separator`/`GroupProps`/`SeparatorProps`, check `node_modules/react-resizable-panels/dist/declarations/src/index.d.ts` for the real names and use those instead.

- [ ] **Step 3: Check for other `panel-group-direction` usages**

```bash
grep -rn "panel-group-direction" --include="*.tsx" --include="*.css" . | grep -v node_modules
```
If any file outside `components/ui/resizable.tsx` styles against this selector, update it to `aria-orientation` the same way.

- [ ] **Step 4: Type-check, build, and manual smoke test**

```bash
npm run type-check
npm run build
```
`npm run dev`, find a resizable panel in the UI (check the chat sidebar or split views) and confirm it still resizes correctly, including the drag handle icon.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/ui/resizable.tsx
git commit -m "chore: upgrade react-resizable-panels to v4"
```

---

### Task 9: shiki 3 → 4, marked 15 → 18

**Files:**
- Modify: `package.json`

**Interfaces:** N/A.

- [ ] **Step 1: Bump both**

```bash
npm install shiki@4 marked@18
```
(Both only require a Node ≥20 floor, already satisfied by Task 1. `components/prompt-kit/code-block.tsx`'s `codeToHtml(code, { lang, theme })` call and `components/prompt-kit/markdown.tsx`'s `marked.lexer(markdown)` + `.raw` usage are both confirmed unaffected by name/shape across these version ranges — no code changes are anticipated.)

- [ ] **Step 2: Type-check and build**

```bash
npm run type-check
npm run build
```
Fix anything actually reported in `components/prompt-kit/code-block.tsx` or `components/prompt-kit/markdown.tsx`.

- [ ] **Step 3: Manual smoke test**

`npm run dev`, send a chat message containing a fenced code block and a markdown list with a trailing blank line. Confirm:
- Code block renders with syntax highlighting.
- Markdown (especially lists) renders identically to before the bump — marked v18 trims trailing blank lines from block tokens, which could very slightly change spacing; visually confirm nothing looks broken.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: upgrade shiki to v4, marked to v18"
```

---

### Task 10: Cleanup — stale `packageManager` field, final full verification

**Files:**
- Modify: `package.json` (remove `packageManager` field)

**Interfaces:** N/A — final task, verifies the whole phase.

- [ ] **Step 1: Remove the stale field**

```bash
grep -n "packageManager" package.json
```
Delete that line (and its trailing comma adjustment) from `package.json`. The repo uses npm (per `package-lock.json` + CI + Dockerfile); this pnpm field was never acted on.

- [ ] **Step 2: Full verification pass**

```bash
npm run type-check
npm run build
npm run lint
```
All three must exit 0.

- [ ] **Step 3: Full manual smoke test**

`npm run dev`, then walk through:
- Send a chat message, confirm streaming response renders.
- Trigger an MCP tool call, confirm it executes and renders.
- Multi-chat / multi-model flow.
- File attachment upload in chat input.
- Usage/cost dashboard charts (recharts).
- Any date picker (react-day-picker).
- Resizable panel drag (react-resizable-panels).
- Spot-check icon rendering (lucide-react) on a few pages.
- Code block + markdown rendering in a chat message.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: remove stale packageManager field"
```

---

## Deferred to Phase B (do not do here)

- `@supabase/ssr` version bump — the entire Supabase integration is removed in Phase B; upgrading it now would be immediately deleted work.
