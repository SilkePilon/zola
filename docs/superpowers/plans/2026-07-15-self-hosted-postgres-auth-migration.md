# Self-hosted Postgres + Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase entirely (auth, database, storage, realtime) with a self-hosted stack: Postgres + Drizzle ORM + Better Auth (Google OAuth + anonymous guest plugin) + MinIO (S3-compatible storage), fully runnable via `docker compose up`.

**Architecture:** A single Postgres instance holds both Better Auth's own tables (user/session/account/verification) and the app's existing 13 tables, all accessed through one Drizzle client (`lib/db/client.ts`). Better Auth replaces every Supabase Auth call site; every `supabase.from()` query is rewritten as a Drizzle query inside the same store module it lives in today, so callers elsewhere in the app don't change. MinIO replaces the Supabase Storage bucket via the S3 API. Postgres becomes a hard runtime requirement (no more "app runs with no persistence" fallback).

**Tech Stack:** Next.js 16 App Router, TypeScript, `drizzle-orm` + `drizzle-kit` (node-postgres driver), `pg`, `better-auth` (Drizzle adapter, `anonymous` + Google OAuth plugins), `@aws-sdk/client-s3` against MinIO, Docker Compose (`postgres:16`, `minio/minio`).

## Global Constraints

- Spec source of truth: `docs/superpowers/specs/2026-07-15-self-hosted-postgres-auth-migration-design.md`.
- No test framework exists in this repo (no Jest/Vitest; CI runs lint/type-check/build only per `CLAUDE.md`). Every task is verified with `npm run type-check`, and where relevant `npm run build`, plus a concrete manual check — not automated unit tests.
- Package manager: npm. Formatting: Prettier — no semicolons, double quotes, `es5` trailing commas, auto-sorted imports (`@ianvs/prettier-plugin-sort-imports`) and Tailwind classes. Run `npx prettier --write <files>` after hand-writing code in each task before committing.
- Path alias `@/*` maps to repo root (`tsconfig.json`).
- Clean cutover: no existing Supabase production data to migrate (confirmed by user).
- Postgres is a hard requirement after this migration — no `isSupabaseEnabled`-style graceful degradation is preserved.
- Realtime (`subscribeToUserUpdates`, live profile sync) is dropped, not replaced.
- Authorization stays app-level: every query explicitly filters by the authenticated user's id, exactly as it does today (Supabase RLS was defined but never enabled).
- Commit after every task using Conventional Commits style (`feat:`, `fix:`, `chore:`, `refactor:`), no `Co-Authored-By`/session trailer needed for plan-execution commits unless the executing agent's own instructions require it.

---

### Task 1: Dependencies, Docker Compose services, and environment variables

**Files:**
- Modify: `package.json` (via `npm install`, not hand-edited)
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Create: `.env.local` entries (documented in step, not committed — `.env.local` is gitignored)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `DATABASE_URL` env var (Postgres connection string, e.g. `postgres://zola:zola@localhost:5432/zola`), `MINIO_ENDPOINT`/`MINIO_PORT`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET`/`MINIO_USE_SSL` env vars, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` env vars — all later tasks read these via `process.env`.

- [ ] **Step 1: Install runtime and dev dependencies**

Run:
```bash
npm install drizzle-orm pg better-auth @aws-sdk/client-s3
npm install -D drizzle-kit @types/pg
```
Expected: `package.json` `dependencies` gains `drizzle-orm`, `pg`, `better-auth`, `@aws-sdk/client-s3`; `devDependencies` gains `drizzle-kit`, `@types/pg`. `package-lock.json` updates. No install errors.

- [ ] **Step 2: Remove Supabase dependency**

Run:
```bash
npm uninstall @supabase/ssr
```
Expected: `@supabase/ssr` removed from `package.json` `dependencies`. (`@supabase/supabase-js` is not a direct dependency today — it's transitive via `@supabase/ssr`'s types — so it disappears from `package-lock.json` on its own once `@supabase/ssr` is gone. If `npm ls @supabase/supabase-js` still shows it afterward, leave it; a later task deletes the last files that reference its types.)

- [ ] **Step 3: Add postgres and minio services to docker-compose.yml**

Replace the full contents of `docker-compose.yml` with:

```yaml
services:
  zola:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_TELEMETRY_DISABLED=1
      - DATABASE_URL=postgres://zola:zola@postgres:5432/zola
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_USE_SSL=false
      - MINIO_ACCESS_KEY=zola
      - MINIO_SECRET_KEY=zola-minio-secret
      - MINIO_BUCKET=chat-attachments
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=zola
      - POSTGRES_PASSWORD=zola
      - POSTGRES_DB=zola
    volumes:
      - zola-postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U zola -d zola"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=zola
      - MINIO_ROOT_PASSWORD=zola-minio-secret
    volumes:
      - zola-minio-data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  zola-postgres-data:
  zola-minio-data:
```

Expected: file saved, valid YAML.

- [ ] **Step 4: Validate compose file syntax**

Run: `docker compose config --quiet`
Expected: no output, exit code 0 (confirms YAML/schema is valid without starting containers).

- [ ] **Step 5: Update .env.example**

Replace the `# Supabase Configuration` block at the top of `.env.example`:

```
# Database (self-hosted Postgres)
DATABASE_URL=postgres://zola:zola@localhost:5432/zola

# Auth (Better Auth)
BETTER_AUTH_SECRET=your_32_character_random_string
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret

# Storage (self-hosted MinIO, S3-compatible)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=zola
MINIO_SECRET_KEY=zola-minio-secret
MINIO_BUCKET=chat-attachments
```

with the rest of the file (CSRF, AI model keys, Ollama, developer tools, production/dev config) unchanged below it.

Expected: `.env.example` has no remaining `SUPABASE`-prefixed vars.

- [ ] **Step 6: Create local .env.local values for development**

Append the same six new vars (Step 5's block, with real local values — `DATABASE_URL=postgres://zola:zola@localhost:5432/zola`, a real `BETTER_AUTH_SECRET` generated via `openssl rand -base64 32`, real Google OAuth credentials from the Google Cloud Console, and the MinIO values matching Step 3's compose config) to `.env.local`. Remove the old `NEXT_PUBLIC_SUPABASE_*`/`SUPABASE_SERVICE_ROLE` lines if present.

Expected: `.env.local` (gitignored, not committed) has `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_USE_SSL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`.

- [ ] **Step 7: Start Postgres and MinIO locally**

Run: `docker compose up -d postgres minio`
Expected: both containers report healthy within ~30s (`docker compose ps` shows `healthy` for both).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json docker-compose.yml .env.example
git commit -m "chore: add self-hosted Postgres/MinIO deps and docker-compose services"
```

---

### Task 2: Drizzle schema, client, and migrations

**Design note (read before writing code):** Better Auth's own tables (created in Task 3) default to `text` primary keys, not native Postgres `uuid`. To keep a real foreign-key relationship between the app's `users` table and Better Auth's `user` table (same id values), this task defines `users.id` and every `user_id` column across all 13 tables as `text`, not `uuid` — this is a deliberate deviation from `supabase/schema.sql` (which used `uuid` throughout, because Supabase Auth's `auth.users.id` was a native uuid). Every other entity's own primary key (`chats.id`, `projects.id`, `messages.id`, etc.) keeps the same type as before. Postgres 16 has `gen_random_uuid()` built in (added in PG13), so no `pgcrypto` extension is needed (the original schema's `create extension pgcrypto` line is dropped).

**Files:**
- Create: `lib/db/schema.ts`
- Create: `lib/db/client.ts`
- Create: `drizzle.config.ts`
- Modify: `package.json` (add `db:generate`/`db:migrate`/`db:studio` scripts)
- Create: `lib/db/migrations/` (generated by drizzle-kit, not hand-written)

**Interfaces:**
- Consumes: `DATABASE_URL` env var from Task 1.
- Produces: `db` (Drizzle instance, `lib/db/client.ts`) — the single query entrypoint every later task imports as `import { db } from "@/lib/db/client"`. Table objects (`users`, `projects`, `chats`, `messages`, `chatAttachments`, `feedback`, `userKeys`, `userPreferences`, `mcpServers`, `customModels`, `modelUsage`, `budgetLimits`, `budgetAlerts`) and inferred row types (`User`, `Chat`, `Message`, `Project`, `ChatAttachment`, `Feedback`, `UserKey`, `UserPreference`, `McpServer`, `CustomModel`, `ModelUsage`, `BudgetLimit`, `BudgetAlert`) exported from `lib/db/schema.ts` — later tasks import both from `@/lib/db/schema`.

- [ ] **Step 1: Write the Drizzle schema**

Create `lib/db/schema.ts`:

```ts
import { sql } from "drizzle-orm"
import {
  bigint,
  bigserial,
  boolean,
  check,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

export const messageRoleEnum = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
  "data",
])

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  anonymous: boolean("anonymous").default(false),
  premium: boolean("premium").default(false),
  displayName: text("display_name"),
  profileImage: text("profile_image"),
  favoriteModels: text("favorite_models")
    .array()
    .default(sql`'{}'::text[]`),
  messageCount: integer("message_count").default(0),
  dailyMessageCount: integer("daily_message_count").default(0),
  dailyReset: timestamp("daily_reset", { withTimezone: true }),
  dailyProMessageCount: integer("daily_pro_message_count").default(0),
  dailyProReset: timestamp("daily_pro_reset", { withTimezone: true }),
  systemPrompt: text("system_prompt"),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_projects_user_id").on(table.userId)]
)

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    projectId: uuid("project_id").references(() => projects.id, {
      onDelete: "set null",
    }),
    model: text("model"),
    title: text("title"),
    public: boolean("public").default(false),
    pinned: boolean("pinned").default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_chats_user_id").on(table.userId),
    index("idx_chats_project_id").on(table.projectId),
    index("idx_chats_created_at").on(table.createdAt),
  ]
)

export const messages = pgTable(
  "messages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    role: messageRoleEnum("role").notNull(),
    content: text("content"),
    parts: jsonb("parts"),
    model: text("model"),
    messageGroupId: text("message_group_id"),
    experimentalAttachments: jsonb("experimental_attachments").default(
      sql`'[]'::jsonb`
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_messages_chat_id").on(table.chatId),
    index("idx_messages_user_id").on(table.userId),
    index("idx_messages_created_at").on(table.createdAt),
  ]
)

export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fileUrl: text("file_url").notNull(),
    fileType: text("file_type"),
    fileSize: integer("file_size"),
    fileName: text("file_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_chat_attachments_chat_id").on(table.chatId),
    index("idx_chat_attachments_user_id").on(table.userId),
  ]
)

export const feedback = pgTable(
  "feedback",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [index("idx_feedback_user_id").on(table.userId)]
)

export const userKeys = pgTable(
  "user_keys",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    encryptedKey: text("encrypted_key").notNull(),
    iv: text("iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.provider] }),
    index("idx_user_keys_user_id").on(table.userId),
  ]
)

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  layout: text("layout"),
  promptSuggestions: boolean("prompt_suggestions"),
  showToolInvocations: boolean("show_tool_invocations"),
  showConversationPreviews: boolean("show_conversation_previews"),
  multiModelEnabled: boolean("multi_model_enabled"),
  hiddenModels: text("hidden_models").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})

export const mcpServers = pgTable(
  "mcp_servers",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").default(true),
    transportType: text("transport_type").notNull(),
    url: text("url"),
    headers: jsonb("headers"),
    icon: text("icon"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_mcp_servers_user_id").on(table.userId),
    index("idx_mcp_servers_enabled")
      .on(table.enabled)
      .where(sql`${table.enabled} = true`),
    check(
      "mcp_servers_transport_type_check",
      sql`${table.transportType} in ('http', 'sse')`
    ),
  ]
)

export const customModels = pgTable(
  "custom_models",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    modelId: text("model_id").notNull(),
    providerId: text("provider_id").notNull(),
    baseUrl: text("base_url"),
    contextWindow: integer("context_window"),
    inputCost: decimal("input_cost", { precision: 10, scale: 6 }),
    outputCost: decimal("output_cost", { precision: 10, scale: 6 }),
    vision: boolean("vision").default(false),
    tools: boolean("tools").default(false),
    reasoning: boolean("reasoning").default(false),
    audio: boolean("audio").default(false),
    video: boolean("video").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_custom_models_user_id").on(table.userId),
    uniqueIndex("idx_custom_models_user_model").on(
      table.userId,
      table.providerId,
      table.modelId
    ),
  ]
)

export const modelUsage = pgTable(
  "model_usage",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id").references(() => chats.id, {
      onDelete: "set null",
    }),
    messageId: bigint("message_id", { mode: "number" }).references(
      () => messages.id,
      { onDelete: "set null" }
    ),
    modelId: text("model_id").notNull(),
    providerId: text("provider_id").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    inputCostPerMillion: decimal("input_cost_per_million", {
      precision: 10,
      scale: 6,
    }),
    outputCostPerMillion: decimal("output_cost_per_million", {
      precision: 10,
      scale: 6,
    }),
    inputCostUsd: decimal("input_cost_usd", { precision: 12, scale: 8 }),
    outputCostUsd: decimal("output_cost_usd", { precision: 12, scale: 8 }),
    totalCostUsd: decimal("total_cost_usd", { precision: 12, scale: 8 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_model_usage_user_id").on(table.userId),
    index("idx_model_usage_chat_id").on(table.chatId),
    index("idx_model_usage_created_at").on(table.createdAt),
    index("idx_model_usage_model_provider").on(
      table.modelId,
      table.providerId
    ),
  ]
)

export const budgetLimits = pgTable(
  "budget_limits",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    providerId: text("provider_id"),
    monthlyBudgetUsd: decimal("monthly_budget_usd", {
      precision: 10,
      scale: 2,
    }),
    dailyBudgetUsd: decimal("daily_budget_usd", { precision: 10, scale: 2 }),
    perChatBudgetUsd: decimal("per_chat_budget_usd", {
      precision: 10,
      scale: 2,
    }),
    currentMonthSpend: decimal("current_month_spend", {
      precision: 12,
      scale: 8,
    }).default("0"),
    currentDaySpend: decimal("current_day_spend", {
      precision: 12,
      scale: 8,
    }).default("0"),
    monthReset: timestamp("month_reset", { withTimezone: true }).defaultNow(),
    dayReset: timestamp("day_reset", { withTimezone: true }).defaultNow(),
    warningThresholdPercent: integer("warning_threshold_percent").default(80),
    emailNotifications: boolean("email_notifications").default(true),
    enforceLimits: boolean("enforce_limits").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_budget_limits_user_id").on(table.userId),
    index("idx_budget_limits_provider")
      .on(table.providerId)
      .where(sql`${table.providerId} is not null`),
    uniqueIndex("budget_limits_user_provider_key").on(
      table.userId,
      table.providerId
    ),
    check(
      "budget_limits_warning_threshold_percent_check",
      sql`${table.warningThresholdPercent} between 0 and 100`
    ),
  ]
)

export const budgetAlerts = pgTable(
  "budget_alerts",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    alertType: text("alert_type").notNull(),
    budgetType: text("budget_type").notNull(),
    thresholdPercent: integer("threshold_percent"),
    amountSpent: decimal("amount_spent", { precision: 12, scale: 8 }),
    budgetLimit: decimal("budget_limit", { precision: 10, scale: 2 }),
    message: text("message"),
    acknowledged: boolean("acknowledged").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_budget_alerts_user_id").on(table.userId),
    index("idx_budget_alerts_created_at").on(table.createdAt),
    index("idx_budget_alerts_acknowledged")
      .on(table.acknowledged)
      .where(sql`${table.acknowledged} = false`),
    check(
      "budget_alerts_alert_type_check",
      sql`${table.alertType} in ('warning', 'limit_reached', 'budget_exceeded')`
    ),
    check(
      "budget_alerts_budget_type_check",
      sql`${table.budgetType} in ('monthly', 'daily', 'per_chat')`
    ),
  ]
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
export type Chat = typeof chats.$inferSelect
export type NewChat = typeof chats.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type ChatAttachment = typeof chatAttachments.$inferSelect
export type NewChatAttachment = typeof chatAttachments.$inferInsert
export type Feedback = typeof feedback.$inferSelect
export type UserKey = typeof userKeys.$inferSelect
export type NewUserKey = typeof userKeys.$inferInsert
export type UserPreference = typeof userPreferences.$inferSelect
export type NewUserPreference = typeof userPreferences.$inferInsert
export type McpServer = typeof mcpServers.$inferSelect
export type NewMcpServer = typeof mcpServers.$inferInsert
export type CustomModel = typeof customModels.$inferSelect
export type NewCustomModel = typeof customModels.$inferInsert
export type ModelUsage = typeof modelUsage.$inferSelect
export type NewModelUsage = typeof modelUsage.$inferInsert
export type BudgetLimit = typeof budgetLimits.$inferSelect
export type NewBudgetLimit = typeof budgetLimits.$inferInsert
export type BudgetAlert = typeof budgetAlerts.$inferSelect
export type NewBudgetAlert = typeof budgetAlerts.$inferInsert
```

- [ ] **Step 2: Write the Drizzle client**

Create `lib/db/client.ts`:

```ts
import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema })
```

- [ ] **Step 3: Write drizzle-kit config**

Create `drizzle.config.ts` (repo root):

```ts
import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
```

- [ ] **Step 4: Add db scripts to package.json**

In `package.json`, add to the `"scripts"` object (after `"analyze"`):

```json
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
```

- [ ] **Step 5: Generate and run the initial migration**

Run:
```bash
npx drizzle-kit generate --name init
```
Expected: `lib/db/migrations/0000_init.sql` (or similar auto-named file) is created containing `CREATE TYPE "public"."message_role" ...` and 13 `CREATE TABLE` statements plus indexes/constraints, along with `lib/db/migrations/meta/`.

Run:
```bash
npm run db:migrate
```
Expected: output confirms migration applied, no errors. Verify with:
```bash
docker compose exec postgres psql -U zola -d zola -c '\dt'
```
Expected: lists all 13 tables (`users`, `projects`, `chats`, `messages`, `chat_attachments`, `feedback`, `user_keys`, `user_preferences`, `mcp_servers`, `custom_models`, `model_usage`, `budget_limits`, `budget_alerts`).

- [ ] **Step 6: Type-check**

Run: `npm run type-check`
Expected: no errors from `lib/db/schema.ts` or `lib/db/client.ts` (other files still reference the old Supabase types at this point in the plan — those are fixed in later tasks, so pre-existing errors elsewhere are expected until Task 9; only confirm no *new* errors originate from the two new files).

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts lib/db/client.ts drizzle.config.ts lib/db/migrations package.json
git commit -m "feat: add Drizzle schema, client, and initial Postgres migration"
```

---

### Task 3: Better Auth server + client setup

**Before starting this task, verify against the installed `better-auth` version's docs/types** (option shapes below are this plan's best understanding at time of writing, not confirmed against a running install):
1. `databaseHooks.user.create.after` callback argument shape — this plan assumes `after: async (betterAuthUser) => …` where `betterAuthUser` has `.id`/`.email`/`.name`/`.image`/`.isAnonymous` directly on it (not nested under `.user`). Check the actual type before writing Step 4.
2. `anonymous()` plugin's `onLinkAccount` callback argument shape — this plan assumes `onLinkAccount: async ({ anonymousUser, newUser }) => …` where each of `anonymousUser`/`newUser` is itself `{ user: { id, ... } }` (hence `anonymousUser.user.id` in Step 4). Check the actual nesting before writing Step 4 — if it's flatter (e.g. `anonymousUser.id` directly), adjust the call in `reassignUserData(...)` accordingly.
3. Anonymous sign-in's generated `email` value — the app's `users.email` column (Task 2) is `NOT NULL`. If Better Auth's anonymous user ends up with a null/empty email, the `databaseHooks.user.create.after` insert in Step 4 throws, leaving a Better Auth `user` row with no matching app `users` row (silent breakage: guest profile lookups return null forever after). Confirm what email value the anonymous plugin actually assigns; if it can be null, generate a placeholder (`` `${betterAuthUser.id}@anonymous.local` ``) in the hook instead of passing it through directly.

**Design note:** Better Auth manages its own `user`/`session`/`account`/`verification` tables, separate from the app's `users` profile table (Task 2). Whenever Better Auth creates a user (Google OAuth first sign-in, or anonymous sign-in), a `databaseHooks.user.create.after` hook inserts the matching profile row into the app's `users` table — this replaces both the old OAuth callback's manual insert and the old `/api/create-guest` insert. When an anonymous user later links to a real Google account, the anonymous plugin's `onLinkAccount` hook reassigns every `user_id`-owned row (chats, messages, projects, etc.) from the anonymous user's id to the new real user's id, then removes the now-orphaned anonymous profile row — this is new behavior the Supabase flow never had.

Separately — and this is a **hard requirement carried into Task 4**, not optional polish — Better Auth's own client (`authClient.signIn.social`, `signOut`, `signIn.anonymous`) posts to `/api/auth/*` directly rather than through `lib/fetch.ts`'s `fetchClient`, so those requests never carry the app's `x-csrf-token` header. Task 4's `proxy.ts` rewrite exempts `/api/auth/*` from the app-level CSRF check for this reason (Better Auth has its own CSRF/origin protection on those routes) — without that exemption, every sign-in/sign-out/guest-creation call 403s.

**Files:**
- Create: `lib/db/auth-schema.ts`
- Modify: `lib/db/client.ts`
- Modify: `drizzle.config.ts`
- Create: `lib/db/reassign-user.ts`
- Create: `lib/auth.ts`
- Create: `lib/auth-client.ts`
- Create: `app/api/auth/[...all]/route.ts`

**Interfaces:**
- Consumes: `db`, `users` table from `@/lib/db/client` / `@/lib/db/schema` (Task 2); `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars (Task 1).
- Produces: `auth` (server instance, `@/lib/auth`) exposing `auth.api.getSession({ headers })` — every later task's API routes use this in place of `supabase.auth.getUser()`. `authClient` (`@/lib/auth-client`) exposing `signIn.social`, `signIn.anonymous`, `signOut`, `useSession` — client components use this in place of `supabase.auth.*`. `reassignUserData(fromUserId, toUserId)` (`@/lib/db/reassign-user`) — bulk-reparents all app rows from one user id to another.

- [ ] **Step 1: Write Better Auth's Drizzle schema**

Create `lib/db/auth-schema.ts`:

```ts
import {
  boolean,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
})
```

- [ ] **Step 2: Merge auth schema into the Drizzle client and config**

Modify `lib/db/client.ts` (replace the full file):

```ts
import "server-only"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"
import * as authSchema from "./auth-schema"
import * as schema from "./schema"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

export const db = drizzle(pool, { schema: { ...schema, ...authSchema } })
```

Modify `drizzle.config.ts` — change the `schema` field:

```ts
import { defineConfig } from "drizzle-kit"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required")
}

export default defineConfig({
  schema: ["./lib/db/schema.ts", "./lib/db/auth-schema.ts"],
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})
```

- [ ] **Step 3: Write the account-linking data-reassignment helper**

Create `lib/db/reassign-user.ts`:

```ts
import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import {
  budgetAlerts,
  budgetLimits,
  chatAttachments,
  chats,
  customModels,
  feedback,
  mcpServers,
  messages,
  modelUsage,
  projects,
  userKeys,
  userPreferences,
  users,
} from "@/lib/db/schema"

export async function reassignUserData(
  fromUserId: string,
  toUserId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ userId: toUserId })
      .where(eq(projects.userId, fromUserId))
    await tx
      .update(chats)
      .set({ userId: toUserId })
      .where(eq(chats.userId, fromUserId))
    await tx
      .update(messages)
      .set({ userId: toUserId })
      .where(eq(messages.userId, fromUserId))
    await tx
      .update(chatAttachments)
      .set({ userId: toUserId })
      .where(eq(chatAttachments.userId, fromUserId))
    await tx
      .update(feedback)
      .set({ userId: toUserId })
      .where(eq(feedback.userId, fromUserId))
    await tx
      .update(userKeys)
      .set({ userId: toUserId })
      .where(eq(userKeys.userId, fromUserId))
    await tx
      .update(mcpServers)
      .set({ userId: toUserId })
      .where(eq(mcpServers.userId, fromUserId))
    await tx
      .update(customModels)
      .set({ userId: toUserId })
      .where(eq(customModels.userId, fromUserId))
    await tx
      .update(modelUsage)
      .set({ userId: toUserId })
      .where(eq(modelUsage.userId, fromUserId))
    await tx
      .update(budgetLimits)
      .set({ userId: toUserId })
      .where(eq(budgetLimits.userId, fromUserId))
    await tx
      .update(budgetAlerts)
      .set({ userId: toUserId })
      .where(eq(budgetAlerts.userId, fromUserId))
    // user_preferences has userId as its primary key, so it can't be
    // reassigned if the target user already has a preferences row —
    // delete the anonymous user's row instead in that case.
    const existingTarget = await tx.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, toUserId),
    })
    if (existingTarget) {
      await tx
        .delete(userPreferences)
        .where(eq(userPreferences.userId, fromUserId))
    } else {
      await tx
        .update(userPreferences)
        .set({ userId: toUserId })
        .where(eq(userPreferences.userId, fromUserId))
    }
    await tx.delete(users).where(eq(users.id, fromUserId))
  })
}
```

- [ ] **Step 4: Write the Better Auth server instance**

Create `lib/auth.ts`:

```ts
import "server-only"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { betterAuth } from "better-auth"
import { anonymous } from "better-auth/plugins"
import { db } from "@/lib/db/client"
import { reassignUserData } from "@/lib/db/reassign-user"
import * as authSchema from "@/lib/db/auth-schema"
import { users } from "@/lib/db/schema"

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
      onLinkAccount: async ({ anonymousUser, newUser }) => {
        await reassignUserData(anonymousUser.user.id, newUser.user.id)
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (betterAuthUser) => {
          await db.insert(users).values({
            id: betterAuthUser.id,
            email: betterAuthUser.email || `${betterAuthUser.id}@anonymous.local`,
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
```

- [ ] **Step 5: Write the Better Auth React client**

Create `lib/auth-client.ts`:

```ts
import { anonymousClient } from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  plugins: [anonymousClient()],
})

export const { signIn, signOut, useSession } = authClient
```

- [ ] **Step 6: Wire up the Better Auth route handler**

Create `app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js"
import { auth } from "@/lib/auth"

export const { GET, POST } = toNextJsHandler(auth)
```

- [ ] **Step 7: Generate and run the auth-tables migration**

Run:
```bash
npx drizzle-kit generate --name add_better_auth_tables
npm run db:migrate
```
Expected: new migration file creates `user`, `session`, `account`, `verification` tables. Verify:
```bash
docker compose exec postgres psql -U zola -d zola -c '\dt'
```
Expected: now lists 17 tables total (13 app tables + `user`, `session`, `account`, `verification`).

- [ ] **Step 8: Type-check**

Run: `npm run type-check`
Expected: no errors originating from `lib/db/auth-schema.ts`, `lib/db/client.ts`, `lib/db/reassign-user.ts`, `lib/auth.ts`, `lib/auth-client.ts`, `app/api/auth/[...all]/route.ts`. Pre-existing errors from not-yet-migrated Supabase call sites are still expected at this point.

- [ ] **Step 9: Commit**

```bash
git add lib/db/auth-schema.ts lib/db/client.ts drizzle.config.ts lib/db/reassign-user.ts lib/auth.ts lib/auth-client.ts app/api/auth/ lib/db/migrations
git commit -m "feat: add Better Auth server/client with Google OAuth and anonymous guest plugin"
```

---

### Task 4: Auth call-site migration

**Design note:** Supabase SSR required a per-request "refresh session" middleware step; Better Auth doesn't — it manages its own cookies on each auth API call, so `proxy.ts` drops that step entirely and keeps only CSRF + CSP. Browser code can no longer query Postgres directly (no browser-safe Drizzle client), so the two client-side profile functions in `lib/user-store/api.ts` (`fetchUserProfile`, `updateUserProfile`) now call a new `app/api/user/route.ts` instead of querying a database client directly. `lib/supabase/*` files are **not deleted yet** — other not-yet-migrated call sites (Tasks 5-7) still import them; Task 9 deletes them once nothing references them.

**Files:**
- Modify: `proxy.ts`
- Delete: `utils/supabase/middleware.ts`
- Delete: `app/auth/callback/route.ts`
- Delete: `app/api/create-guest/route.ts`
- Modify: `lib/routes.ts` (remove `API_ROUTE_CREATE_GUEST`)
- Modify: `lib/api.ts` (rewrite `signInWithGoogle`, `getOrCreateGuestUserId`; remove `createGuestUser`)
- Modify: `app/auth/login-page.tsx`
- Modify: `app/auth/login/actions.ts`
- Modify: `app/auth/page.tsx`
- Modify: `app/components/chat/dialog-auth.tsx`
- Modify: `app/components/chat-input/popover-content-auth.tsx`
- Modify: `app/c/[chatId]/page.tsx`
- Modify: `app/p/[projectId]/page.tsx`
- Create: `lib/db/mappers.ts`
- Modify: `lib/user/types.ts`
- Modify: `lib/user/api.ts`
- Create: `app/api/user/route.ts`
- Modify: `lib/user-store/api.ts`
- Modify: `lib/user-store/provider.tsx`

**Interfaces:**
- Consumes: `auth` (`@/lib/auth`), `authClient` (`@/lib/auth-client`) from Task 3; `db`, `users`, `userPreferences`, `projects` from `@/lib/db/schema`/`@/lib/db/client` from Task 2.
- Produces: `mapUserRow(row: User): UserProfileRow` and `mapUserProfileUpdates(updates): Partial<NewUser>` (`@/lib/db/mappers`) — Task 5-7 route handlers that touch user profile fields reuse these. `UserProfile` type (`@/lib/user/types`) redefined as `ReturnType<typeof mapUserRow> & { preferences?: UserPreferences }` — same snake_case shape as before (`display_name`, `profile_image`, etc.), so no UI component consuming `useUser()` needs to change. `fetchUserProfile(): Promise<UserProfile | null>` (no `id` param — resolved server-side from the session cookie) and `updateUserProfile(id: string, updates: Partial<UserProfile>): Promise<boolean>` from `@/lib/user-store/api`.

- [ ] **Step 1: Simplify proxy.ts (drop Supabase session refresh, keep CSRF + CSP)**

Replace the full contents of `proxy.ts`:

```ts
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
```

Note `https://api.supabase.com` and the dynamic `supabaseDomain` are gone from `connect-src`; `https://accounts.google.com` is added since the browser now talks to Google directly during OAuth instead of proxying through Supabase.

- [ ] **Step 2: Delete the Supabase middleware helper**

Run: `rm utils/supabase/middleware.ts`
Expected: file removed. (`utils/supabase/` may now be empty — that's fine, an empty directory isn't tracked by git.)

- [ ] **Step 3: Delete the Supabase OAuth callback and create-guest routes**

Run:
```bash
rm app/auth/callback/route.ts
rm app/api/create-guest/route.ts
```
Expected: both files removed. Better Auth's catch-all route (`app/api/auth/[...all]/route.ts`, Task 3) handles the OAuth callback at `/api/auth/callback/google` and creates the app-level profile row via the `databaseHooks.user.create.after` hook (Task 3) — no separate callback/create-guest route is needed anymore.

- [ ] **Step 4: Remove the now-unused create-guest route constant**

In `lib/routes.ts`, delete the line:
```ts
export const API_ROUTE_CREATE_GUEST = "/api/create-guest"
```

- [ ] **Step 5: Rewrite lib/api.ts's auth functions**

In `lib/api.ts`, replace the imports at the top of the file:

```ts
import { APP_DOMAIN } from "@/lib/config"
import { authClient } from "@/lib/auth-client"
import type { UserProfile } from "@/lib/user/types"
import { fetchClient } from "./fetch"
import { API_ROUTE_UPDATE_CHAT_MODEL } from "./routes"
```

Delete the `createGuestUser` function entirely (lines 8-31 of the original file).

Replace the `signInWithGoogle` function:

```ts
/**
 * Signs in user with Google OAuth via Better Auth
 * @param redirectPath - Optional path to redirect to after successful login (defaults to current path or /)
 */
export async function signInWithGoogle(redirectPath?: string) {
  try {
    const baseUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : process.env.NEXT_PUBLIC_SITE_URL
          ? process.env.NEXT_PUBLIC_SITE_URL
          : process.env.NEXT_PUBLIC_VERCEL_URL
            ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
            : APP_DOMAIN

    let nextPath = redirectPath

    if (!nextPath && typeof window !== "undefined") {
      const currentPath = `${window.location.pathname}${window.location.search}`
      nextPath = currentPath.startsWith("/auth") ? "/" : currentPath || "/"
    }

    nextPath = nextPath || "/"

    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${baseUrl}${nextPath}`,
    })

    if (error) {
      throw new Error(error.message)
    }
  } catch (err) {
    console.error("Error signing in with Google:", err)
    throw err
  }
}
```

Replace the `getOrCreateGuestUserId` function:

```ts
export const getOrCreateGuestUserId = async (
  user: UserProfile | null
): Promise<string | null> => {
  if (user?.id) return user.id

  const { data: session } = await authClient.getSession()
  if (session?.user?.id) return session.user.id

  try {
    const { data, error } = await authClient.signIn.anonymous()

    if (error || !data?.user) {
      console.error("Error during anonymous sign-in:", error)
      return null
    }

    return data.user.id
  } catch (error) {
    console.error(
      "Error in getOrCreateGuestUserId during anonymous sign-in:",
      error
    )
    return null
  }
}
```

(`checkRateLimits` and `updateChatModel` in `lib/api.ts` are unrelated to auth — leave them unchanged.)

- [ ] **Step 6: Update the login page**

Replace `app/auth/login-page.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { signInWithGoogle } from "@/lib/api"
import Link from "next/link"
import { useState } from "react"
import { HeaderGoBack } from "../components/header-go-back"

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignInWithGoogle() {
    try {
      setIsLoading(true)
      setError(null)

      // From login page, always redirect to home after auth
      await signInWithGoogle("/")
    } catch (err: unknown) {
      console.error("Error signing in with Google:", err)
      setError(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-background flex h-dvh w-full flex-col">
      <HeaderGoBack href="/" />

      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-foreground text-3xl font-medium tracking-tight sm:text-4xl">
              Welcome to Zola
            </h1>
            <p className="text-muted-foreground mt-3">
              Sign in below to increase your message limits.
            </p>
          </div>
          {error && (
            <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {error}
            </div>
          )}
          <div className="mt-8">
            <Button
              variant="secondary"
              className="w-full text-base sm:text-base"
              size="lg"
              onClick={handleSignInWithGoogle}
              disabled={isLoading}
            >
              <img
                src="https://www.google.com/favicon.ico"
                alt="Google logo"
                width={20}
                height={20}
                className="mr-2 size-4"
              />
              <span>
                {isLoading ? "Connecting..." : "Continue with Google"}
              </span>
            </Button>
          </div>
        </div>
      </main>

      <footer className="text-muted-foreground py-6 text-center text-sm">
        <p>
          By continuing, you agree to our{" "}
          <Link href="/" className="text-foreground hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/" className="text-foreground hover:underline">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  )
}
```

(`await signInWithGoogle("/")` triggers a full-page redirect to Google on success, so `setIsLoading(false)` on the success path is unreachable/unnecessary — only the error path resets it, matching the redirect-based flow.)

- [ ] **Step 7: Update the sign-out server action**

Replace `app/auth/login/actions.ts`:

```ts
"use server"

import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function signOut() {
  await auth.api.signOut({ headers: await headers() })
  revalidatePath("/", "layout")
  redirect("/auth/login")
}
```

- [ ] **Step 8: Simplify the auth page gate**

Replace `app/auth/page.tsx`:

```tsx
import LoginPage from "./login-page"

export default function AuthPage() {
  return <LoginPage />
}
```

- [ ] **Step 9: Update dialog-auth.tsx and popover-content-auth.tsx**

Replace `app/components/chat/dialog-auth.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { signInWithGoogle } from "@/lib/api"
import { useState } from "react"

type DialogAuthProps = {
  open: boolean
  setOpen: (open: boolean) => void
}

export function DialogAuth({ open, setOpen }: DialogAuthProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignInWithGoogle = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Pass current path so user returns here after login
      const currentPath = `${window.location.pathname}${window.location.search}`
      await signInWithGoogle(currentPath)
    } catch (err: unknown) {
      setError(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            You&apos;ve reached the limit for today
          </DialogTitle>
          <DialogDescription className="pt-2 text-base">
            Sign in below to increase your message limits.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
            {error}
          </div>
        )}
        <DialogFooter className="mt-6 sm:justify-center">
          <Button
            variant="secondary"
            className="w-full text-base"
            size="lg"
            onClick={handleSignInWithGoogle}
            disabled={isLoading}
          >
            <img
              src="https://www.google.com/favicon.ico"
              alt="Google logo"
              width={20}
              height={20}
              className="mr-2 size-4"
            />
            <span>{isLoading ? "Connecting..." : "Continue with Google"}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

Replace `app/components/chat-input/popover-content-auth.tsx`:

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { PopoverContent } from "@/components/ui/popover"
import { signInWithGoogle } from "@/lib/api"
import { APP_NAME } from "@/lib/config"
import Image from "next/image"
import { useState } from "react"

export function PopoverContentAuth() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSignInWithGoogle = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Pass current path so user returns here after login
      const currentPath = `${window.location.pathname}${window.location.search}`
      await signInWithGoogle(currentPath)
    } catch (err: unknown) {
      console.error("Error signing in with Google:", err)
      setError(
        (err as Error).message ||
          "An unexpected error occurred. Please try again."
      )
      setIsLoading(false)
    }
  }
  return (
    <PopoverContent
      className="w-[300px] overflow-hidden rounded-xl p-0"
      side="top"
      align="start"
    >
      <Image
        src="/banner_forest.jpg"
        alt={`calm paint generate by ${APP_NAME}`}
        width={300}
        height={128}
        className="h-32 w-full object-cover"
      />
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}
      <div className="p-3">
        <p className="text-primary mb-1 text-base font-medium">
          Login to try more features for free
        </p>
        <p className="text-muted-foreground mb-5 text-base">
          Add files, use more models, BYOK, and more.
        </p>
        <Button
          variant="secondary"
          className="w-full text-base"
          size="lg"
          onClick={handleSignInWithGoogle}
          disabled={isLoading}
        >
          <img
            src="https://www.google.com/favicon.ico"
            alt="Google logo"
            width={20}
            height={20}
            className="mr-2 size-4"
          />
          <span>{isLoading ? "Connecting..." : "Continue with Google"}</span>
        </Button>
      </div>
    </PopoverContent>
  )
}
```

- [ ] **Step 10: Update chat/project page auth+ownership guards**

Replace `app/c/[chatId]/page.tsx`:

```tsx
import { ChatContainer } from "@/app/components/chat/chat-container"
import { LayoutApp } from "@/app/components/layout/layout-app"
import { auth } from "@/lib/auth"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect("/")
  }

  return (
    <MessagesProvider>
      <LayoutApp>
        <ChatContainer />
      </LayoutApp>
    </MessagesProvider>
  )
}
```

Replace `app/p/[projectId]/page.tsx`:

```tsx
import { LayoutApp } from "@/app/components/layout/layout-app"
import { ProjectView } from "@/app/p/[projectId]/project-view"
import { auth } from "@/lib/auth"
import { MessagesProvider } from "@/lib/chat-store/messages/provider"
import { db } from "@/lib/db/client"
import { projects } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

type Props = {
  params: Promise<{ projectId: string }>
}

export default async function Page({ params }: Props) {
  const { projectId } = await params

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    redirect("/")
  }

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
    )
    .limit(1)

  if (!project) {
    redirect("/")
  }

  return (
    <MessagesProvider>
      <LayoutApp>
        <ProjectView projectId={projectId} key={projectId} />
      </LayoutApp>
    </MessagesProvider>
  )
}
```

- [ ] **Step 11: Write the user-row mapper helpers**

Create `lib/db/mappers.ts`:

```ts
import type { NewUser, User } from "@/lib/db/schema"

export function mapUserRow(row: User) {
  return {
    id: row.id,
    email: row.email,
    anonymous: row.anonymous ?? false,
    premium: row.premium ?? false,
    display_name: row.displayName ?? "",
    profile_image: row.profileImage ?? "",
    favorite_models: row.favoriteModels ?? [],
    message_count: row.messageCount ?? 0,
    daily_message_count: row.dailyMessageCount ?? 0,
    daily_reset: row.dailyReset ? row.dailyReset.toISOString() : null,
    daily_pro_message_count: row.dailyProMessageCount ?? 0,
    daily_pro_reset: row.dailyProReset
      ? row.dailyProReset.toISOString()
      : null,
    system_prompt: row.systemPrompt,
    last_active_at: row.lastActiveAt ? row.lastActiveAt.toISOString() : null,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
  }
}

export type UserProfileRow = ReturnType<typeof mapUserRow>

export function mapUserProfileUpdates(
  updates: Partial<{
    display_name: string
    profile_image: string
    favorite_models: string[]
    system_prompt: string | null
    premium: boolean
  }>
): Partial<NewUser> {
  const row: Partial<NewUser> = {}
  if ("display_name" in updates) row.displayName = updates.display_name
  if ("profile_image" in updates) row.profileImage = updates.profile_image
  if ("favorite_models" in updates) row.favoriteModels = updates.favorite_models
  if ("system_prompt" in updates) row.systemPrompt = updates.system_prompt
  if ("premium" in updates) row.premium = updates.premium
  return row
}
```

- [ ] **Step 12: Update the UserProfile type**

Replace `lib/user/types.ts`:

```ts
import type { mapUserRow } from "@/lib/db/mappers"
import type { UserPreferences } from "../user-preference-store/utils"

export type UserProfile = ReturnType<typeof mapUserRow> & {
  preferences?: UserPreferences
}
```

- [ ] **Step 13: Rewrite the server-side user profile lookup**

Replace `lib/user/api.ts`:

```ts
import "server-only"
import { auth } from "@/lib/auth"
import { mapUserRow } from "@/lib/db/mappers"
import { db } from "@/lib/db/client"
import { userPreferences, users } from "@/lib/db/schema"
import { convertFromApiFormat } from "@/lib/user-preference-store/utils"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import type { UserProfile } from "./types"

export async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  return session?.user ?? null
}

export async function getUserProfile(): Promise<UserProfile | null> {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return null

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  // Don't load anonymous users in the user store
  if (!profile || profile.anonymous) return null

  const [preferences] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, sessionUser.id))
    .limit(1)

  return {
    ...mapUserRow(profile),
    preferences: preferences ? convertFromApiFormat(preferences) : undefined,
  }
}
```

- [ ] **Step 14: Create the client-facing user profile API route**

Create `app/api/user/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapUserProfileUpdates, mapUserRow } from "@/lib/db/mappers"
import { userPreferences, users } from "@/lib/db/schema"
import { convertFromApiFormat } from "@/lib/user-preference-store/utils"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1)

  if (!profile || profile.anonymous) {
    return NextResponse.json({ user: null })
  }

  const [preferences] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, session.user.id))
    .limit(1)

  return NextResponse.json({
    user: {
      ...mapUserRow(profile),
      preferences: preferences
        ? convertFromApiFormat(preferences)
        : undefined,
    },
  })
}

export async function PUT(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const updates = await request.json()

  await db
    .update(users)
    .set(mapUserProfileUpdates(updates))
    .where(eq(users.id, session.user.id))

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 15: Rewrite the client-side user-store API module**

Replace `lib/user-store/api.ts`:

```ts
import { toast } from "@/components/ui/toast"
import { authClient } from "@/lib/auth-client"
import { fetchClient } from "@/lib/fetch"
import type { UserProfile } from "@/lib/user/types"

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const res = await fetchClient("/api/user")
  if (!res.ok) return null
  const { user } = await res.json()
  return user
}

export async function updateUserProfile(
  _id: string,
  updates: Partial<UserProfile>
): Promise<boolean> {
  const res = await fetchClient("/api/user", {
    method: "PUT",
    body: JSON.stringify(updates),
  })
  return res.ok
}

export async function signOutUser(): Promise<boolean> {
  try {
    await authClient.signOut()
    return true
  } catch (error) {
    console.error("Failed to sign out:", error)
    toast({ title: "Failed to sign out", status: "error" })
    return false
  }
}
```

(`updateUserProfile` keeps its `id` parameter, now unused, so every existing call site — which passes `user.id` — doesn't need to change; the session cookie determines the target user server-side.)

- [ ] **Step 16: Update the user provider (drop realtime, use new fetchUserProfile signature)**

Replace `lib/user-store/provider.tsx`:

```tsx
// app/providers/user-provider.tsx
"use client"

import {
  fetchUserProfile,
  signOutUser,
  updateUserProfile,
} from "@/lib/user-store/api"
import type { UserProfile } from "@/lib/user/types"
import { createContext, useContext, useState } from "react"

type UserContextType = {
  user: UserProfile | null
  isLoading: boolean
  updateUser: (updates: Partial<UserProfile>) => Promise<void>
  refreshUser: () => Promise<void>
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode
  initialUser: UserProfile | null
}) {
  const [user, setUser] = useState<UserProfile | null>(initialUser)
  const [isLoading, setIsLoading] = useState(false)

  const refreshUser = async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const updatedUser = await fetchUserProfile()
      if (updatedUser) setUser(updatedUser)
    } finally {
      setIsLoading(false)
    }
  }

  const updateUser = async (updates: Partial<UserProfile>) => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      const success = await updateUserProfile(user.id, updates)
      if (success) {
        setUser((prev) => (prev ? { ...prev, ...updates } : null))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      const success = await signOutUser()
      if (success) setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <UserContext.Provider
      value={{ user, isLoading, updateUser, refreshUser, signOut }}
    >
      {children}
    </UserContext.Provider>
  )
}

// Custom hook to use the user context
export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider")
  }
  return context
}
```

(The `useEffect`-based `subscribeToUserUpdates` realtime subscription is dropped per the design spec — cross-tab profile sync is no longer live-pushed; `refreshUser()` remains available for explicit refetches.)

- [ ] **Step 17: Type-check**

Run: `npm run type-check`
Expected: no errors from any of the 18 files touched in this task. Errors from not-yet-migrated files (chat-store, budget, mcp-store, etc. — Tasks 5-7) are still expected.

- [ ] **Step 18: Manual verification**

Run: `npm run dev`, then in a browser:
1. Visit `/auth` — login page renders.
2. Click "Continue with Google" — redirects to Google's consent screen.
3. After consenting, redirected back to the app, logged in (check dev tools → Application → Cookies for a Better Auth session cookie).
4. Sign out — redirected to `/auth/login`, session cookie cleared.

Expected: all four steps succeed with no server errors in the `npm run dev` terminal output.

- [ ] **Step 19: Commit**

```bash
git add proxy.ts lib/routes.ts lib/api.ts app/auth lib/db/mappers.ts lib/user lib/user-store app/api/user app/components/chat/dialog-auth.tsx app/components/chat-input/popover-content-auth.tsx "app/c/[chatId]/page.tsx" "app/p/[projectId]/page.tsx"
git rm utils/supabase/middleware.ts app/api/create-guest/route.ts
git commit -m "feat: migrate auth call sites from Supabase to Better Auth"
```

---

### Task 5: Chat-store DB migration (chats, messages, chat route, create-chat)

**Design note:** `lib/chat-store/chats/api.ts` and `lib/chat-store/messages/api.ts` currently query Supabase *directly from the browser* (they import `lib/supabase/client.ts`, the browser client). Drizzle has no browser-safe client, so their DB-touching functions now call new Next.js API routes instead. Because Supabase RLS was never enabled, the original `updateChatTitleInDb`/`deleteChatInDb` queries had **no ownership check at all** (any request could rewrite/delete any chat by id); the new API routes add an explicit `chats.userId = session.user.id` check on every write — a real fix enabled by (and necessary for) this migration, not scope creep. Message *reads* stay unauthenticated-by-id (matching today's behavior, which the `/share/[chatId]` public-link feature depends on); message *writes* are ownership-checked.

Separately, `validateAndTrackUsage` and friends in `app/api/chat/api.ts` currently thread a per-request Supabase client (`SupabaseClientType`) through half a dozen functions, because Supabase's RLS-bound client had to be created fresh per request. Drizzle's `db` is a stateless singleton pool, so none of that threading is needed — every function now imports `db` directly and `validateUserIdentity`/`validateAndTrackUsage` return a `boolean` instead of a client. This task establishes that convention; Task 6 (`lib/usage.ts`, `lib/budget.ts`) continues it, so `checkUsageByModel(userId, model, isAuthenticated)`, `incrementUsage(userId)`, `checkBudgetBeforeChat(userId, providerId)`, and `updateBudgetSpending(userId, providerId, totalCostUsd)` (all called from files this task touches) are defined **without** a leading `supabase` argument once Task 6 finishes — until then, those three call sites are expected type errors (same "fixed by a later task" pattern as Tasks 2-4).

The dead `createChat`/`createChatInDb` pair inside `lib/chat-store/chats/api.ts` (confirmed via repo-wide grep to have zero callers — the actually-used creation path is `createNewChat`, which calls the separate `/api/create-chat` route) is deleted rather than translated.

**Files:**
- Create: `app/api/chats/route.ts`
- Create: `app/api/chats/[chatId]/route.ts`
- Create: `app/api/chats/[chatId]/messages/route.ts`
- Create: `app/api/chats/[chatId]/messages/from/[messageId]/route.ts`
- Modify: `lib/db/mappers.ts` (append `mapChatRow`, `mapMessageRow`)
- Modify: `lib/chat-store/types.ts`
- Modify: `lib/chat-store/chats/api.ts`
- Modify: `lib/chat-store/messages/api.ts`
- Modify: `lib/server/api.ts`
- Modify: `app/types/api.types.ts`
- Modify: `app/api/chat/db.ts`
- Modify: `app/api/chat/api.ts`
- Modify: `app/api/chat/usage-tracking.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/create-chat/api.ts`
- Modify: `app/share/[chatId]/article.tsx`

**Interfaces:**
- Consumes: `auth`, `db`, `chats`, `messages`, `modelUsage` from Tasks 2-3.
- Produces: `mapChatRow(row: Chat)` / `mapMessageRow(row: Message)` (`@/lib/db/mappers`) returning snake_case shapes matching the old Supabase rows, so `Chat`/`Chats`/`Message` types (`@/lib/chat-store/types`) and every UI component that reads `chat.user_id`/`chat.pinned_at`/etc. keep working unchanged. `validateUserIdentity(userId, isAuthenticated): Promise<boolean>` (`@/lib/server/api`) — throws on invalid identity, resolves `true` otherwise. `validateAndTrackUsage(params): Promise<boolean>`, `storeAssistantMessage(params): Promise<number | undefined>` (returns the inserted message id directly via Drizzle's `.returning()`, replacing the old separate "fetch the id back" query) — `@/app/api/chat/api`.

- [ ] **Step 1: Extend the DB mappers with chat and message row mappers**

Append to `lib/db/mappers.ts` (after the existing `mapUserRow`/`mapUserProfileUpdates` code):

```ts
import type { Chat, Message } from "@/lib/db/schema"

export function mapChatRow(row: Chat) {
  return {
    id: row.id,
    user_id: row.userId,
    project_id: row.projectId,
    model: row.model,
    title: row.title,
    public: row.public ?? false,
    pinned: row.pinned ?? false,
    pinned_at: row.pinnedAt ? row.pinnedAt.toISOString() : null,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
    updated_at: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

export function mapMessageRow(row: Message) {
  return {
    id: String(row.id),
    chat_id: row.chatId,
    user_id: row.userId,
    role: row.role,
    content: row.content,
    parts: row.parts,
    model: row.model,
    message_group_id: row.messageGroupId,
    experimental_attachments: row.experimentalAttachments,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
  }
}
```

Add `Chat, Message` to the existing `import type { NewUser, User } from "@/lib/db/schema"` line at the top of the file instead of a second import statement — the final import line reads:

```ts
import type { Chat, Message, NewUser, User } from "@/lib/db/schema"
```

- [ ] **Step 2: Update chat-store types to use the new mappers**

Replace `lib/chat-store/types.ts`:

```ts
import type { mapChatRow, mapMessageRow } from "@/lib/db/mappers"

export type Chat = ReturnType<typeof mapChatRow>
export type Chats = ReturnType<typeof mapChatRow>
export type Message = ReturnType<typeof mapMessageRow>
```

- [ ] **Step 3: Create the chats list API route**

Create `app/api/chats/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapChatRow } from "@/lib/db/mappers"
import { chats } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ chats: [] })
  }

  const rows = await db
    .select()
    .from(chats)
    .where(eq(chats.userId, session.user.id))
    .orderBy(
      desc(chats.pinned),
      sql`${chats.pinnedAt} DESC NULLS LAST`,
      desc(chats.updatedAt)
    )

  return NextResponse.json({ chats: rows.map(mapChatRow) })
}
```

- [ ] **Step 4: Create the single-chat API route (title update, delete)**

Create `app/api/chats/[chatId]/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ chatId: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { title } = (await request.json()) as { title: string }

  const result = await db
    .update(chats)
    .set({ title, updatedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))
    .returning({ id: chats.id })

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))
    .returning({ id: chats.id })

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 5: Create the chat messages API route**

Create `app/api/chats/[chatId]/messages/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapMessageRow } from "@/lib/db/mappers"
import { chats, messages } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ chatId: string }> }

type IncomingMessage = {
  role: "system" | "user" | "assistant" | "data"
  content?: string
  parts?: unknown
  created_at?: string
  message_group_id?: string | null
  model?: string | null
}

async function assertChatOwnership(chatId: string, userId: string) {
  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  return Boolean(chat && chat.userId === userId)
}

export async function GET(_request: Request, { params }: Params) {
  const { chatId } = await params

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(asc(messages.createdAt))

  return NextResponse.json({ messages: rows.map(mapMessageRow) })
}

export async function POST(request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await assertChatOwnership(chatId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { messages: incoming } = (await request.json()) as {
    messages: IncomingMessage[]
  }

  if (!Array.isArray(incoming) || incoming.length === 0) {
    return NextResponse.json(
      { error: "No messages provided" },
      { status: 400 }
    )
  }

  await db.insert(messages).values(
    incoming.map((message) => ({
      chatId,
      role: message.role,
      content: message.content,
      parts: message.parts,
      createdAt: message.created_at
        ? new Date(message.created_at)
        : new Date(),
      messageGroupId: message.message_group_id ?? null,
      model: message.model ?? null,
    }))
  )

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { chatId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await assertChatOwnership(chatId, session.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await db.delete(messages).where(eq(messages.chatId, chatId))

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 6: Create the "delete messages from id onward" API route**

Create `app/api/chats/[chatId]/messages/from/[messageId]/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats, messages } from "@/lib/db/schema"
import { and, eq, gte } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ chatId: string; messageId: string }> }

export async function DELETE(_request: Request, { params }: Params) {
  const { chatId, messageId } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [chat] = await db
    .select({ userId: chats.userId })
    .from(chats)
    .where(eq(chats.id, chatId))
    .limit(1)

  if (!chat || chat.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [target] = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(eq(messages.chatId, chatId), eq(messages.id, Number(messageId)))
    )
    .limit(1)

  if (!target || !target.createdAt) {
    return NextResponse.json({ success: true })
  }

  await db
    .delete(messages)
    .where(
      and(eq(messages.chatId, chatId), gte(messages.createdAt, target.createdAt))
    )

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 7: Rewrite lib/chat-store/chats/api.ts**

Replace the full file:

```ts
import { readFromIndexedDB, writeToIndexedDB } from "@/lib/chat-store/persist"
import type { Chat, Chats } from "@/lib/chat-store/types"
import { MODEL_DEFAULT } from "../../config"
import { fetchClient } from "../../fetch"
import {
  API_ROUTE_TOGGLE_CHAT_PIN,
  API_ROUTE_UPDATE_CHAT_MODEL,
} from "../../routes"

export async function getChatsForUserInDb(userId: string): Promise<Chats[]> {
  if (!userId) return []

  const res = await fetchClient("/api/chats")
  if (!res.ok) return []

  const { chats } = (await res.json()) as { chats: Chats[] }
  return chats
}

export async function updateChatTitleInDb(id: string, title: string) {
  const res = await fetchClient(`/api/chats/${id}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to update chat title")
}

export async function deleteChatInDb(id: string) {
  const res = await fetchClient(`/api/chats/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete chat")
}

export async function getAllUserChatsInDb(userId: string): Promise<Chats[]> {
  const chats = await getChatsForUserInDb(userId)
  return [...chats].sort(
    (a, b) => +new Date(b.created_at || "") - +new Date(a.created_at || "")
  )
}

export async function fetchAndCacheChats(userId: string): Promise<Chats[]> {
  const data = await getChatsForUserInDb(userId)

  if (data.length > 0) {
    await writeToIndexedDB("chats", data)
  }

  return data
}

export async function getCachedChats(): Promise<Chats[]> {
  const all = await readFromIndexedDB<Chats>("chats")
  return (all as Chats[]).sort(
    (a, b) => +new Date(b.created_at || "") - +new Date(a.created_at || "")
  )
}

export async function updateChatTitle(
  id: string,
  title: string
): Promise<void> {
  await updateChatTitleInDb(id, title)
  const all = await getCachedChats()
  const updated = (all as Chats[]).map((c) =>
    c.id === id ? { ...c, title } : c
  )
  await writeToIndexedDB("chats", updated)
}

export async function deleteChat(id: string): Promise<void> {
  await deleteChatInDb(id)
  const all = await getCachedChats()
  await writeToIndexedDB(
    "chats",
    (all as Chats[]).filter((c) => c.id !== id)
  )
}

export async function getChat(chatId: string): Promise<Chat | null> {
  const all = await readFromIndexedDB<Chat>("chats")
  return (all as Chat[]).find((c) => c.id === chatId) || null
}

export async function getUserChats(userId: string): Promise<Chat[]> {
  const data = await getAllUserChatsInDb(userId)
  if (!data) return []
  await writeToIndexedDB("chats", data)
  return data
}

export async function updateChatModel(chatId: string, model: string) {
  try {
    const res = await fetchClient(API_ROUTE_UPDATE_CHAT_MODEL, {
      method: "POST",
      body: JSON.stringify({ chatId, model }),
    })
    const responseData = await res.json()

    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update chat model: ${res.status} ${res.statusText}`
      )
    }

    const all = await getCachedChats()
    const updated = (all as Chats[]).map((c) =>
      c.id === chatId ? { ...c, model } : c
    )
    await writeToIndexedDB("chats", updated)

    return responseData
  } catch (error) {
    console.error("Error updating chat model:", error)
    throw error
  }
}

export async function toggleChatPin(chatId: string, pinned: boolean) {
  try {
    const res = await fetchClient(API_ROUTE_TOGGLE_CHAT_PIN, {
      method: "POST",
      body: JSON.stringify({ chatId, pinned }),
    })
    const responseData = await res.json()
    if (!res.ok) {
      throw new Error(
        responseData.error ||
          `Failed to update pinned: ${res.status} ${res.statusText}`
      )
    }
    const all = await getCachedChats()
    const now = new Date().toISOString()
    const updated = (all as Chats[]).map((c) =>
      c.id === chatId ? { ...c, pinned, pinned_at: pinned ? now : null } : c
    )
    await writeToIndexedDB("chats", updated)
    return responseData
  } catch (error) {
    console.error("Error updating chat pinned:", error)
    throw error
  }
}

export async function createNewChat(
  userId: string,
  title?: string,
  model?: string,
  isAuthenticated?: boolean,
  projectId?: string
): Promise<Chats> {
  try {
    const payload: {
      userId: string
      title: string
      model: string
      isAuthenticated?: boolean
      projectId?: string
    } = {
      userId,
      title: title || "New Chat",
      model: model || MODEL_DEFAULT,
      isAuthenticated,
    }

    if (projectId) {
      payload.projectId = projectId
    }

    const res = await fetchClient("/api/create-chat", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    const responseData = await res.json()

    if (!res.ok || !responseData.chat) {
      throw new Error(responseData.error || "Failed to create chat")
    }

    const chat: Chats = responseData.chat

    await writeToIndexedDB("chats", chat)
    return chat
  } catch (error) {
    console.error("Error creating new chat:", error)
    throw error
  }
}
```

(`createChat`/`createChatInDb` — the unused direct-insert pair — and the manual `Content-Type` header on each `fetchClient` call are dropped; `fetchClient` already sets `Content-Type: application/json`, so passing it again was redundant.)

- [ ] **Step 8: Rewrite lib/chat-store/messages/api.ts**

Replace the full file:

```ts
import type { UIMessage as MessageAISDK } from "ai"
import { fetchClient } from "../../fetch"
import { readFromIndexedDB, writeToIndexedDB } from "../persist"

type ChatMessage = MessageAISDK & {
  content?: string
  createdAt?: Date
  message_group_id?: string | null
  model?: string | null
}

type MessageRow = {
  id: string
  content: string | null
  role: string
  created_at: string | null
  parts: unknown
  message_group_id: string | null
  model: string | null
}

export async function getMessagesFromDb(
  chatId: string
): Promise<ChatMessage[]> {
  const res = await fetchClient(`/api/chats/${chatId}/messages`)
  if (!res.ok) {
    return await getCachedMessages(chatId)
  }

  const { messages } = (await res.json()) as { messages: MessageRow[] }

  return messages.map((message) => ({
    id: message.id,
    role: message.role as ChatMessage["role"],
    content: message.content ?? "",
    parts: message.parts as ChatMessage["parts"],
    createdAt: new Date(message.created_at || ""),
    message_group_id: message.message_group_id,
    model: message.model,
  }))
}

async function postMessagesToDb(chatId: string, messages: ChatMessage[]) {
  await fetchClient(`/api/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        content: (message as { content?: string }).content,
        parts: message.parts,
        created_at:
          message.createdAt?.toISOString() || new Date().toISOString(),
        message_group_id: message.message_group_id || null,
        model: message.model || null,
      })),
    }),
  })
}

async function deleteMessagesFromDb(chatId: string) {
  const res = await fetchClient(`/api/chats/${chatId}/messages`, {
    method: "DELETE",
  })
  if (!res.ok) {
    console.error("Failed to clear messages from database:", await res.text())
  }
}

async function deleteMessagesFromId(chatId: string, messageId: string) {
  const res = await fetchClient(
    `/api/chats/${chatId}/messages/from/${messageId}`,
    { method: "DELETE" }
  )
  if (!res.ok) {
    console.error("Failed to delete messages:", await res.text())
  }
}

type ChatMessageEntry = {
  id: string
  messages: ChatMessage[]
}

export async function getCachedMessages(
  chatId: string
): Promise<ChatMessage[]> {
  const entry = await readFromIndexedDB<ChatMessageEntry>("messages", chatId)

  if (!entry || Array.isArray(entry)) return []

  return (entry.messages || []).sort(
    (a, b) => +new Date(a.createdAt || 0) - +new Date(b.createdAt || 0)
  )
}

export async function cacheMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function addMessage(
  chatId: string,
  message: ChatMessage
): Promise<void> {
  await postMessagesToDb(chatId, [message])
  const current = await getCachedMessages(chatId)
  const updated = [...current, message]

  await writeToIndexedDB("messages", { id: chatId, messages: updated })
}

export async function setMessages(
  chatId: string,
  messages: ChatMessage[]
): Promise<void> {
  await postMessagesToDb(chatId, messages)
  await writeToIndexedDB("messages", { id: chatId, messages })
}

export async function clearMessagesCache(chatId: string): Promise<void> {
  await writeToIndexedDB("messages", { id: chatId, messages: [] })
}

export async function clearMessagesForChat(chatId: string): Promise<void> {
  await deleteMessagesFromDb(chatId)
  await clearMessagesCache(chatId)
}

export async function deleteMessagesFromIdForChat(
  chatId: string,
  messageId: string,
  remainingMessages: ChatMessage[]
): Promise<void> {
  await deleteMessagesFromId(chatId, messageId)
  await writeToIndexedDB("messages", {
    id: chatId,
    messages: remainingMessages,
  })
}
```

(The manual "parts sometimes arrives as a JSON string" parsing workaround is dropped — that was a PostgREST/Supabase JS quirk; our own `/api/chats/[chatId]/messages` route always returns properly-typed JSON.)

- [ ] **Step 9: Rewrite lib/server/api.ts**

Replace the full file:

```ts
import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"

/**
 * Validates that the claimed userId matches the actual session (for
 * authenticated requests) or an existing anonymous guest row (for
 * unauthenticated requests). Throws on any mismatch.
 */
export async function validateUserIdentity(
  userId: string,
  isAuthenticated: boolean
): Promise<boolean> {
  if (isAuthenticated) {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user?.id) {
      throw new Error("Unable to get authenticated user")
    }

    if (session.user.id !== userId) {
      throw new Error("User ID does not match authenticated user")
    }
  } else {
    const [userRecord] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.anonymous, true)))
      .limit(1)

    if (!userRecord) {
      throw new Error("Invalid or missing guest user")
    }
  }

  return true
}
```

- [ ] **Step 10: Update app/types/api.types.ts to drop the Supabase client type**

Replace the full file:

```ts
export interface ContentPart {
  type: string
  text?: string
  toolCallId?: string
  toolName?: string
  args?: unknown
  result?: unknown
  toolInvocation?: {
    state: string
    step: number
    toolCallId: string
    toolName: string
    args?: unknown
    result?: unknown
  }
  reasoningText?: string
  details?: unknown[]
}

export interface Message {
  role: "user" | "assistant" | "system" | "data" | "tool" | "tool-call"
  content: string | null | ContentPart[]
  reasoningText?: string
}

export interface ChatApiParams {
  userId: string
  model: string
  isAuthenticated: boolean
}

export interface LogUserMessageParams {
  userId: string
  chatId: string
  parts: ContentPart[]
  model: string
  isAuthenticated: boolean
  message_group_id?: string
}

export interface StoreAssistantMessageParams {
  chatId: string
  messages: Message[]
  message_group_id?: string
  model?: string
}

export interface ApiErrorResponse {
  error: string
  details?: string
}

export interface ApiSuccessResponse<T = unknown> {
  success: true
  data?: T
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse
```

- [ ] **Step 11: Rewrite app/api/chat/db.ts**

Replace the full file:

```ts
import type { ContentPart, Message } from "@/app/types/api.types"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"

const DEFAULT_STEP = 0

export async function saveFinalAssistantMessage(
  chatId: string,
  messagesInput: Message[],
  message_group_id?: string,
  model?: string
): Promise<number | undefined> {
  const parts: ContentPart[] = []
  const toolMap = new Map<string, ContentPart>()
  const textParts: string[] = []

  for (const msg of messagesInput) {
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text") {
          textParts.push(part.text || "")
          parts.push(part)
        } else if (part.type === "tool-call") {
          const toolCallId = (part as any).toolCallId || ""
          if (!toolCallId) continue

          toolMap.set(toolCallId, {
            type: "tool-invocation",
            toolInvocation: {
              state: "call",
              step: DEFAULT_STEP,
              toolCallId,
              toolName: (part as any).toolName || "",
              args: (part as any).input || (part as any).args || {},
            },
          })
        } else if (part.type === "tool-invocation" && part.toolInvocation) {
          const { toolCallId, state } = part.toolInvocation
          if (!toolCallId) continue

          const existing = toolMap.get(toolCallId)
          if (state === "result" || !existing) {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args:
                  part.toolInvocation?.args ||
                  existing?.toolInvocation?.args ||
                  {},
                result:
                  part.toolInvocation?.result ||
                  existing?.toolInvocation?.result,
              },
            })
          } else if (state === "call") {
            toolMap.set(toolCallId, {
              ...part,
              toolInvocation: {
                ...part.toolInvocation,
                args: part.toolInvocation?.args || {},
              },
            })
          }
        } else if (part.type === "reasoning") {
          parts.push({
            type: "reasoning",
            reasoningText: part.text || "",
            details: [
              {
                type: "text",
                text: part.text || "",
              },
            ],
          })
        } else if (part.type === "step-start") {
          parts.push(part)
        }
      }
    } else if (msg.role === "tool" && Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "tool-result") {
          const toolCallId = (part as any).toolCallId || ""
          const existing = toolMap.get(toolCallId)

          toolMap.set(toolCallId, {
            type: "tool-invocation",
            toolInvocation: {
              state: "result",
              step: DEFAULT_STEP,
              toolCallId,
              toolName:
                existing?.toolInvocation?.toolName ||
                (part as any).toolName ||
                "unknown",
              args:
                existing?.toolInvocation?.args ||
                (part as any).input ||
                (part as any).args ||
                {},
              result: (part as any).result || (part as any).output,
            },
          })
        }
      }
    }
  }

  parts.push(...toolMap.values())

  const finalPlainText = textParts.join("\n\n")

  try {
    const [row] = await db
      .insert(messages)
      .values({
        chatId,
        role: "assistant",
        content: finalPlainText || "",
        parts: parts as unknown,
        messageGroupId: message_group_id,
        model,
      })
      .returning({ id: messages.id })

    console.log("Assistant message saved successfully (merged).")
    return row?.id
  } catch (error) {
    console.error("Error saving final assistant message:", error)
    throw new Error(
      `Failed to save assistant message: ${(error as Error).message}`
    )
  }
}
```

- [ ] **Step 12: Rewrite app/api/chat/api.ts**

Replace the full file:

```ts
import { saveFinalAssistantMessage } from "@/app/api/chat/db"
import type {
  ChatApiParams,
  LogUserMessageParams,
  StoreAssistantMessageParams,
} from "@/app/types/api.types"
import { db } from "@/lib/db/client"
import { messages } from "@/lib/db/schema"
import { getAllModels } from "@/lib/models"
import { sanitizeUserInput } from "@/lib/sanitize"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel, incrementUsage } from "@/lib/usage"
import { getUserKey, type ProviderWithoutOllama } from "@/lib/user-keys"

export async function validateAndTrackUsage({
  userId,
  model,
  isAuthenticated,
}: ChatApiParams): Promise<boolean> {
  await validateUserIdentity(userId, isAuthenticated)

  if (!isAuthenticated) {
    throw new Error(
      "Authentication required. Please sign in to use AI models."
    )
  } else {
    const { getCustomModels } = await import("@/lib/models/custom")
    const customModels = await getCustomModels()
    const allModels = await getAllModels(customModels)

    const modelConfig = allModels.find((m) => m.uniqueId === model)

    if (!modelConfig) {
      throw new Error(`Model ${model} not found`)
    }

    const provider = modelConfig.providerId

    if (provider !== "ollama") {
      const userApiKey = await getUserKey(
        userId,
        provider as ProviderWithoutOllama
      )

      if (!userApiKey) {
        throw new Error(
          `This model requires an API key for ${provider}. Please add your API key in settings.`
        )
      }
    }
  }

  await checkUsageByModel(userId, model, isAuthenticated)

  const providerId = model.includes(":") ? model.split(":")[0] : model

  try {
    const { checkBudgetBeforeChat } = await import("@/lib/budget")
    await checkBudgetBeforeChat(userId, providerId)
  } catch (err: any) {
    if (err.name === "BudgetExceededError") {
      const providerText = err.provider ? ` for ${err.provider}` : ""
      err.message = `${err.message}${providerText}. You've spent $${err.spent.toFixed(4)} of your $${err.limit} ${err.budgetType} budget limit.`
      throw err
    }
    console.error("Error checking budget:", err)
  }

  return true
}

export async function incrementMessageCount({
  userId,
}: {
  userId: string
}): Promise<void> {
  try {
    await incrementUsage(userId)
  } catch (err) {
    console.error("Failed to increment message count:", err)
  }
}

export async function logUserMessage({
  userId,
  chatId,
  parts,
  message_group_id,
}: LogUserMessageParams): Promise<void> {
  const text = Array.isArray(parts)
    ? parts
        .filter(
          (p: any) => p?.type === "text" && typeof p.text === "string"
        )
        .map((p: any) => p.text as string)
        .join("\n\n")
    : ""

  try {
    await db.insert(messages).values({
      chatId,
      role: "user",
      content: sanitizeUserInput(text),
      parts: parts as unknown,
      userId,
      messageGroupId: message_group_id,
    })
  } catch (error) {
    console.error("Error saving user message:", error)
  }
}

export async function storeAssistantMessage({
  chatId,
  messages: messageList,
  message_group_id,
  model,
}: StoreAssistantMessageParams): Promise<number | undefined> {
  try {
    return await saveFinalAssistantMessage(
      chatId,
      messageList,
      message_group_id,
      model
    )
  } catch (err) {
    console.error("Failed to save assistant messages:", err)
    return undefined
  }
}
```

- [ ] **Step 13: Rewrite app/api/chat/usage-tracking.ts**

Replace the full file:

```ts
import { db } from "@/lib/db/client"
import { modelUsage } from "@/lib/db/schema"

type UsageData = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

type ModelPricing = {
  inputCost?: number
  outputCost?: number
}

/**
 * Track model usage in the database with cost calculation
 * Only tracks if pricing information is available
 */
export async function trackModelUsage({
  userId,
  chatId,
  messageId,
  modelId,
  providerId,
  usage,
  pricing,
}: {
  userId: string
  chatId: string
  messageId?: number
  modelId: string
  providerId: string
  usage: UsageData
  pricing: ModelPricing
}): Promise<void> {
  if (!pricing.inputCost && !pricing.outputCost) {
    return
  }

  const inputCostUsd = pricing.inputCost
    ? (usage.inputTokens / 1_000_000) * pricing.inputCost
    : null
  const outputCostUsd = pricing.outputCost
    ? (usage.outputTokens / 1_000_000) * pricing.outputCost
    : null

  const totalCostUsd = (inputCostUsd ?? 0) + (outputCostUsd ?? 0) || null

  try {
    await db.insert(modelUsage).values({
      userId,
      chatId,
      messageId,
      modelId,
      providerId,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      inputCostPerMillion: pricing.inputCost ? String(pricing.inputCost) : null,
      outputCostPerMillion: pricing.outputCost
        ? String(pricing.outputCost)
        : null,
      inputCostUsd: inputCostUsd !== null ? String(inputCostUsd) : null,
      outputCostUsd: outputCostUsd !== null ? String(outputCostUsd) : null,
      totalCostUsd: totalCostUsd !== null ? String(totalCostUsd) : null,
    })

    if (totalCostUsd && totalCostUsd > 0) {
      try {
        const { updateBudgetSpending } = await import("@/lib/budget")
        await updateBudgetSpending(userId, providerId, totalCostUsd)
      } catch (budgetError) {
        console.error("Error updating budget spending:", budgetError)
      }
    }
  } catch (err) {
    console.error("Failed to track model usage:", err)
  }
}
```

- [ ] **Step 14: Update app/api/chat/route.ts to use the boolean canPersist flag**

Replace the full file:

```ts
import type { ContentPart } from "@/app/types/api.types"
import { buildMcpTools, type MCPServerConfig } from "@/lib/mcp/tools"
import { getAllModels } from "@/lib/models"
import type { ProviderWithoutOllama } from "@/lib/user-keys"
import { getUserKey } from "@/lib/user-keys"
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  ToolSet,
  type UIMessage,
} from "ai"
import { SYSTEM_PROMPT_DEFAULT } from "@/lib/config"
import {
  incrementMessageCount,
  logUserMessage,
  storeAssistantMessage,
  validateAndTrackUsage,
} from "./api"
import { trackModelUsage } from "./usage-tracking"
import { createErrorResponse, extractErrorMessage } from "./utils"

export const maxDuration = 60

type ChatRequest = {
  messages: UIMessage[]
  chatId: string
  userId: string
  model: string
  isAuthenticated: boolean
  systemPrompt: string
  enableSearch: boolean
  message_group_id?: string
  mcpServers?: MCPServerConfig[]
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      messages,
      chatId,
      userId,
      model,
      isAuthenticated,
      systemPrompt,
      enableSearch,
      message_group_id,
      mcpServers,
    } = body as ChatRequest

    if (!messages || !chatId || !userId) {
      return new Response(
        JSON.stringify({ error: "Error, missing information" }),
        { status: 400 }
      )
    }

    const canPersist = await validateAndTrackUsage({
      userId,
      model,
      isAuthenticated,
    })

    if (canPersist) {
      await incrementMessageCount({ userId })
    }

    const userMessage = messages[messages.length - 1]

    if (canPersist && userMessage?.role === "user") {
      await logUserMessage({
        userId,
        chatId,
        parts: (userMessage.parts || []) as unknown as ContentPart[],
        model,
        isAuthenticated,
        message_group_id,
      })
    }

    const { getCustomModels } = await import("@/lib/models/custom")
    const customModels = await getCustomModels()

    const customModelsForCache =
      customModels && customModels.length > 0 ? customModels : undefined

    const globalModels = await getAllModels(undefined)

    const allModels = customModelsForCache
      ? [...globalModels, ...customModelsForCache]
      : globalModels

    const modelConfig = allModels.find((m) => m.uniqueId === model)

    if (!modelConfig || !modelConfig.apiSdk) {
      throw new Error(`Model ${model} not found`)
    }

    const effectiveSystemPrompt = systemPrompt || SYSTEM_PROMPT_DEFAULT

    let apiKey: string | undefined
    if (isAuthenticated && userId && modelConfig.providerId !== "ollama") {
      const { getEffectiveApiKey } = await import("@/lib/user-keys")
      let key = await getEffectiveApiKey(
        userId,
        modelConfig.providerId as ProviderWithoutOllama
      )
      if (!key) {
        try {
          key = await getUserKey(userId, modelConfig.providerId as any)
        } catch {}
      }
      apiKey = key || undefined
    }

    const makeModel = modelConfig.apiSdk
    if (!makeModel) {
      throw new Error(`Selected model ${model} is not invokable`)
    }

    if (!Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Invalid messages format" }),
        { status: 400 }
      )
    }

    const modelMessages = await convertToModelMessages(messages)

    const enabledMcpServers = Array.isArray(mcpServers)
      ? mcpServers.filter((s) => s && typeof s === "object" && s.enabled === true)
      : []
    const { tools: mcpTools, close: closeMcp } =
      await buildMcpTools(enabledMcpServers)

    let mcpClosed = false
    const safeCloseMcp = async () => {
      if (mcpClosed || !closeMcp) return
      mcpClosed = true
      try {
        await closeMcp()
      } catch (closeError) {
        console.error("Error closing MCP transports:", closeError)
      }
    }

    try {
      const modelInstance = await makeModel(apiKey, { enableSearch })

      const streamTextOptions: Parameters<typeof streamText>[0] = {
        model: modelInstance,
        system: effectiveSystemPrompt,
        messages: modelMessages,
        stopWhen: stepCountIs(10),
        onFinish: async ({ response, usage }) => {
          try {
            let savedMessageId: number | undefined

            if (canPersist && response.messages?.length) {
              savedMessageId = await storeAssistantMessage({
                chatId,
                messages: response.messages as any[],
                message_group_id,
                model,
              })
            }

            if (canPersist && usage && (usage.inputTokens || usage.outputTokens)) {
              await trackModelUsage({
                userId,
                chatId,
                messageId: savedMessageId,
                modelId: modelConfig.id,
                providerId: modelConfig.providerId,
                usage: {
                  inputTokens: usage.inputTokens || 0,
                  outputTokens: usage.outputTokens || 0,
                  totalTokens: usage.totalTokens || 0,
                },
                pricing: {
                  inputCost: modelConfig.inputCost,
                  outputCost: modelConfig.outputCost,
                },
              })
            }
          } catch (saveError) {
            console.error("Error in onFinish:", saveError)
          } finally {
            await safeCloseMcp()
          }
        },
        onError: async (error: unknown) => {
          await safeCloseMcp()
          throw error
        },
      }

      if (modelConfig.tools && mcpTools && Object.keys(mcpTools).length > 0) {
        streamTextOptions.tools = mcpTools as ToolSet
      }

      const result = streamText(streamTextOptions)

      return result.toUIMessageStreamResponse({
        sendReasoning: true,
        sendSources: true,
        messageMetadata: ({ part }) => {
          if (part.type === "finish") {
            return { totalUsage: part.totalUsage }
          }
        },
        onError: (error: unknown) => {
          safeCloseMcp().catch((e) =>
            console.error("Error closing MCP in onError:", e)
          )
          return extractErrorMessage(error)
        },
      })
    } catch (streamError) {
      await safeCloseMcp()
      throw streamError
    }
  } catch (err: unknown) {
    const errorName = (err as any)?.name
    if (errorName !== "BudgetExceededError") {
      console.error("Error in /api/chat:", err)
    }

    const error = err as {
      code?: string
      message?: string
      statusCode?: number
      name?: string
    }

    return createErrorResponse(error)
  }
}
```

(The AI SDK's `UIMessage["parts"]` type and `app/types/api.types.ts`'s `ContentPart[]` type are structurally close but not identical, hence the `as unknown as ContentPart[]` cast on the `logUserMessage` call above.)

- [ ] **Step 15: Rewrite app/api/create-chat/api.ts**

Replace the full file:

```ts
import { db } from "@/lib/db/client"
import { mapChatRow } from "@/lib/db/mappers"
import { chats } from "@/lib/db/schema"
import { validateUserIdentity } from "@/lib/server/api"
import { checkUsageByModel } from "@/lib/usage"

type CreateChatInput = {
  userId: string
  title?: string
  model: string
  isAuthenticated: boolean
  projectId?: string
}

export async function createChatInDb({
  userId,
  title,
  model,
  isAuthenticated,
  projectId,
}: CreateChatInput) {
  await validateUserIdentity(userId, isAuthenticated)
  await checkUsageByModel(userId, model, isAuthenticated)

  const [row] = await db
    .insert(chats)
    .values({
      userId,
      title: title || "New Chat",
      model,
      projectId: projectId ?? null,
    })
    .returning()

  return row ? mapChatRow(row) : null
}
```

`app/api/create-chat/route.ts` needs no change — it already treats a `null` return from `createChatInDb` as a soft "not available" response, which now simply can't happen since `validateUserIdentity` throws instead of silently returning null (caught by the route's existing `try`/`catch`).

- [ ] **Step 16: Fix the leftover database.types.ts import in the share page**

In `app/share/[chatId]/article.tsx`, replace:

```ts
import type { Tables } from "@/app/types/database.types"
```
and
```ts
type MessageType = Tables<"messages">
```

with:

```ts
import type { Message } from "@/lib/chat-store/types"
```
and
```ts
type MessageType = Message
```

- [ ] **Step 17: Type-check**

Run: `npm run type-check`
Expected: no errors from any file touched in this task. Errors originating from `lib/usage.ts`/`lib/budget.ts` (whose `checkUsageByModel`/`incrementUsage`/`checkBudgetBeforeChat`/`updateBudgetSpending` signatures haven't been updated yet — that's Task 6) and other not-yet-migrated files are still expected.

- [ ] **Step 18: Commit**

```bash
git add app/api/chats lib/db/mappers.ts lib/chat-store app/types/api.types.ts app/api/chat app/api/create-chat/api.ts "app/share/[chatId]/article.tsx" lib/server/api.ts
git commit -m "feat: migrate chat/message persistence from Supabase to Drizzle"
```

---

### Task 6: Budget/usage/models DB migration

**Design note:** This task establishes the no-supabase-argument convention (set up in Task 5) for `lib/usage.ts` and `lib/budget.ts` — every function drops its leading `supabase` parameter and imports `db` directly. `budget_limits`, `budget_alerts`, and `model_usage` all have `decimal`/`numeric` columns; the Postgres `pg` driver (and therefore Drizzle) returns these as **strings**, not numbers, to avoid float precision loss — Supabase's PostgREST layer, by contrast, serialized them as JSON numbers. Every route in this task that returns these columns to the browser converts them back to `Number` explicitly (via new `mapBudgetLimitRow`/`mapBudgetAlertRow` mappers, mirroring Task 5's `mapChatRow`), so the frontend (which reads `budget.monthly_budget_usd`, `alert.alert_type`, etc. in snake_case, unchanged) doesn't need to change.

Separately: `supabase/schema.sql` relies on Postgres triggers (`trg_chats_updated_at`, `trg_budget_limits_updated_at`, etc.) to auto-set `updated_at` on every `UPDATE`. The Drizzle schema (Task 2) does not define equivalent triggers, so every `UPDATE` in this task (and Task 7) explicitly sets `updatedAt: new Date()` in the `.set()` call — this is called out per-step below so it isn't silently dropped.

`lib/models/route.ts` is deleted — a repo-wide grep confirms nothing imports it; since it lives under `lib/` (not `app/api/`), Next.js never wired it up as a route handler in the first place, and `app/api/providers/route.ts` is the real, reachable implementation of the same GET/POST pair. It's dead code, not a migration target.

**Files:**
- Modify: `lib/db/mappers.ts` (append `mapBudgetLimitRow`, `mapBudgetAlertRow`)
- Modify: `lib/usage.ts`
- Modify: `lib/budget.ts`
- Modify: `app/api/budget-alerts/route.ts`
- Modify: `app/api/budget-limits/route.ts`
- Modify: `app/api/budget-status/route.ts`
- Modify: `app/api/model-usage/route.ts`
- Modify: `lib/models/custom.ts`
- Modify: `app/api/custom-models/route.ts`
- Modify: `app/api/providers/route.ts`
- Modify: `app/api/models/route.ts`
- Delete: `lib/models/route.ts`

**Interfaces:**
- Consumes: `db`, `budgetLimits`, `budgetAlerts`, `modelUsage`, `customModels`, `userKeys`, `users` from `@/lib/db/schema`/`@/lib/db/client`; `auth` from `@/lib/auth`.
- Produces: `checkUsageByModel(userId, modelId, isAuthenticated)`, `incrementUsage(userId)`, `checkUsage(userId)`, `checkProUsage(userId)`, `incrementProUsage(userId)`, `incrementUsageByModel(userId, modelId, isAuthenticated)` (`@/lib/usage`) — matching the signatures Task 5's `app/api/chat/api.ts` already assumed. `checkBudgetBeforeChat(userId, providerId?, chatId?)`, `updateBudgetSpending(userId, providerId, costUsd)`, `BudgetExceededError` (`@/lib/budget`) — matching Task 5's `app/api/chat/api.ts` and `app/api/chat/usage-tracking.ts`. `mapBudgetLimitRow(row)`, `mapBudgetAlertRow(row)` (`@/lib/db/mappers`).

- [ ] **Step 1: Extend the DB mappers with budget row mappers**

Append to `lib/db/mappers.ts`:

```ts
export function mapBudgetLimitRow(row: BudgetLimit) {
  return {
    id: row.id,
    user_id: row.userId,
    provider_id: row.providerId,
    monthly_budget_usd:
      row.monthlyBudgetUsd !== null ? Number(row.monthlyBudgetUsd) : null,
    daily_budget_usd:
      row.dailyBudgetUsd !== null ? Number(row.dailyBudgetUsd) : null,
    per_chat_budget_usd:
      row.perChatBudgetUsd !== null ? Number(row.perChatBudgetUsd) : null,
    current_month_spend: Number(row.currentMonthSpend ?? 0),
    current_day_spend: Number(row.currentDaySpend ?? 0),
    month_reset: row.monthReset ? row.monthReset.toISOString() : null,
    day_reset: row.dayReset ? row.dayReset.toISOString() : null,
    warning_threshold_percent: row.warningThresholdPercent ?? 80,
    email_notifications: row.emailNotifications ?? true,
    enforce_limits: row.enforceLimits ?? true,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
    updated_at: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

export function mapBudgetAlertRow(row: BudgetAlert) {
  return {
    id: row.id,
    user_id: row.userId,
    alert_type: row.alertType,
    budget_type: row.budgetType,
    threshold_percent: row.thresholdPercent,
    amount_spent: row.amountSpent !== null ? Number(row.amountSpent) : null,
    budget_limit: row.budgetLimit !== null ? Number(row.budgetLimit) : null,
    message: row.message,
    acknowledged: row.acknowledged ?? false,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
  }
}
```

Update the top-of-file type import to include the two new row types:

```ts
import type {
  BudgetAlert,
  BudgetLimit,
  Chat,
  Message,
  NewUser,
  User,
} from "@/lib/db/schema"
```

- [ ] **Step 2: Rewrite lib/usage.ts**

Replace the full file:

```ts
import "server-only"
import { UsageLimitError } from "@/lib/api"
import {
  AUTH_DAILY_MESSAGE_LIMIT,
  DAILY_LIMIT_PRO_MODELS,
  NON_AUTH_DAILY_MESSAGE_LIMIT,
} from "@/lib/config"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export async function checkUsage(userId: string) {
  const [userData] = await db
    .select({
      messageCount: users.messageCount,
      dailyMessageCount: users.dailyMessageCount,
      dailyReset: users.dailyReset,
      anonymous: users.anonymous,
      premium: users.premium,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("User record not found for id: " + userId)
  }

  const isAnonymous = userData.anonymous
  const dailyLimit = isAnonymous
    ? NON_AUTH_DAILY_MESSAGE_LIMIT
    : AUTH_DAILY_MESSAGE_LIMIT

  const now = new Date()
  let dailyCount = userData.dailyMessageCount || 0
  const lastReset = userData.dailyReset ? new Date(userData.dailyReset) : null

  const isNewDay =
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()

  if (isNewDay) {
    dailyCount = 0
    await db
      .update(users)
      .set({ dailyMessageCount: 0, dailyReset: now })
      .where(eq(users.id, userId))
  }

  if (dailyCount >= dailyLimit) {
    throw new UsageLimitError("Daily message limit reached.")
  }

  return {
    userData,
    dailyCount,
    dailyLimit,
  }
}

export async function incrementUsage(userId: string): Promise<void> {
  const [userData] = await db
    .select({
      messageCount: users.messageCount,
      dailyMessageCount: users.dailyMessageCount,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("Error fetching user data: User not found")
  }

  const newOverallCount = (userData.messageCount || 0) + 1
  const newDailyCount = (userData.dailyMessageCount || 0) + 1

  await db
    .update(users)
    .set({
      messageCount: newOverallCount,
      dailyMessageCount: newDailyCount,
      lastActiveAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function checkProUsage(userId: string) {
  const [userData] = await db
    .select({
      dailyProMessageCount: users.dailyProMessageCount,
      dailyProReset: users.dailyProReset,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("User not found for ID: " + userId)
  }

  let dailyProCount = userData.dailyProMessageCount || 0
  const now = new Date()
  const lastReset = userData.dailyProReset
    ? new Date(userData.dailyProReset)
    : null

  const isNewDay =
    !lastReset ||
    now.getUTCFullYear() !== lastReset.getUTCFullYear() ||
    now.getUTCMonth() !== lastReset.getUTCMonth() ||
    now.getUTCDate() !== lastReset.getUTCDate()

  if (isNewDay) {
    dailyProCount = 0
    await db
      .update(users)
      .set({ dailyProMessageCount: 0, dailyProReset: now })
      .where(eq(users.id, userId))
  }

  if (dailyProCount >= DAILY_LIMIT_PRO_MODELS) {
    throw new UsageLimitError("Daily Pro model limit reached.")
  }

  return {
    dailyProCount,
    limit: DAILY_LIMIT_PRO_MODELS,
  }
}

export async function incrementProUsage(userId: string) {
  const [userData] = await db
    .select({ dailyProMessageCount: users.dailyProMessageCount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!userData) {
    throw new Error("Failed to fetch user usage for increment")
  }

  const count = userData.dailyProMessageCount || 0

  await db
    .update(users)
    .set({
      dailyProMessageCount: count + 1,
      lastActiveAt: new Date(),
    })
    .where(eq(users.id, userId))
}

export async function checkUsageByModel(
  userId: string,
  _modelId: string,
  _isAuthenticated: boolean
) {
  return await checkUsage(userId)
}

export async function incrementUsageByModel(
  userId: string,
  _modelId: string,
  _isAuthenticated: boolean
) {
  return await incrementUsage(userId)
}
```

- [ ] **Step 3: Rewrite lib/budget.ts**

Replace the full file:

```ts
import "server-only"
import { db } from "@/lib/db/client"
import { budgetAlerts, budgetLimits, modelUsage } from "@/lib/db/schema"
import { and, eq, gte, isNull, or } from "drizzle-orm"

export class BudgetExceededError extends Error {
  constructor(
    message: string,
    public budgetType: "monthly" | "daily" | "per_chat",
    public spent: number,
    public limit: number,
    public provider?: string
  ) {
    super(message)
    this.name = "BudgetExceededError"
  }
}

export async function checkBudgetBeforeChat(
  userId: string,
  providerId?: string,
  chatId?: string
) {
  const allBudgets = await db
    .select()
    .from(budgetLimits)
    .where(
      and(
        eq(budgetLimits.userId, userId),
        or(
          providerId ? eq(budgetLimits.providerId, providerId) : undefined,
          isNull(budgetLimits.providerId)
        )
      )
    )

  if (allBudgets.length === 0) {
    return null
  }

  const budget =
    allBudgets.find((b) => b.providerId === providerId) ||
    allBudgets.find((b) => b.providerId === null) ||
    null

  if (!budget) {
    return null
  }

  if (!budget.enforceLimits) {
    return budget
  }

  const now = new Date()
  let currentDaySpend = Number(budget.currentDaySpend ?? 0)
  let currentMonthSpend = Number(budget.currentMonthSpend ?? 0)

  const dayReset = budget.dayReset ? new Date(budget.dayReset) : null
  const isDayReset =
    !dayReset ||
    now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
    now.getUTCMonth() !== dayReset.getUTCMonth() ||
    now.getUTCDate() !== dayReset.getUTCDate()

  const monthReset = budget.monthReset ? new Date(budget.monthReset) : null
  const isMonthReset =
    !monthReset ||
    now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
    now.getUTCMonth() !== monthReset.getUTCMonth()

  const resetUpdates: {
    currentDaySpend?: string
    dayReset?: Date
    currentMonthSpend?: string
    monthReset?: Date
    updatedAt?: Date
  } = {}
  if (isDayReset && currentDaySpend > 0) {
    currentDaySpend = 0
    resetUpdates.currentDaySpend = "0"
    resetUpdates.dayReset = now
  }
  if (isMonthReset && currentMonthSpend > 0) {
    currentMonthSpend = 0
    resetUpdates.currentMonthSpend = "0"
    resetUpdates.monthReset = now
  }

  if (Object.keys(resetUpdates).length > 0) {
    resetUpdates.updatedAt = now
    await db
      .update(budgetLimits)
      .set(resetUpdates)
      .where(eq(budgetLimits.id, budget.id))
  }

  const monthlyBudgetUsd =
    budget.monthlyBudgetUsd !== null ? Number(budget.monthlyBudgetUsd) : null
  if (monthlyBudgetUsd !== null && currentMonthSpend >= monthlyBudgetUsd) {
    throw new BudgetExceededError(
      "Monthly budget limit exceeded",
      "monthly",
      currentMonthSpend,
      monthlyBudgetUsd,
      providerId
    )
  }

  const dailyBudgetUsd =
    budget.dailyBudgetUsd !== null ? Number(budget.dailyBudgetUsd) : null
  if (dailyBudgetUsd !== null && currentDaySpend >= dailyBudgetUsd) {
    throw new BudgetExceededError(
      "Daily budget limit exceeded",
      "daily",
      currentDaySpend,
      dailyBudgetUsd,
      providerId
    )
  }

  const perChatBudgetUsd =
    budget.perChatBudgetUsd !== null ? Number(budget.perChatBudgetUsd) : null
  if (perChatBudgetUsd !== null && chatId) {
    const chatSpending = await db
      .select({ totalCostUsd: modelUsage.totalCostUsd })
      .from(modelUsage)
      .where(
        and(eq(modelUsage.userId, userId), eq(modelUsage.chatId, chatId))
      )

    const chatTotal = chatSpending.reduce(
      (sum, usage) => sum + Number(usage.totalCostUsd ?? 0),
      0
    )

    if (chatTotal >= perChatBudgetUsd) {
      throw new BudgetExceededError(
        "Per-chat budget limit exceeded",
        "per_chat",
        chatTotal,
        perChatBudgetUsd,
        providerId
      )
    }
  }

  return {
    ...budget,
    currentDaySpend: String(currentDaySpend),
    currentMonthSpend: String(currentMonthSpend),
  }
}

export async function updateBudgetSpending(
  userId: string,
  providerId: string,
  costUsd: number
): Promise<void> {
  const allBudgets = await db
    .select()
    .from(budgetLimits)
    .where(
      and(
        eq(budgetLimits.userId, userId),
        or(eq(budgetLimits.providerId, providerId), isNull(budgetLimits.providerId))
      )
    )

  if (allBudgets.length === 0) {
    return
  }

  const budget =
    allBudgets.find((b) => b.providerId === providerId) ||
    allBudgets.find((b) => b.providerId === null) ||
    null

  if (!budget) {
    return
  }

  const currentDaySpend = Number(budget.currentDaySpend ?? 0) + costUsd
  const currentMonthSpend = Number(budget.currentMonthSpend ?? 0) + costUsd

  await db
    .update(budgetLimits)
    .set({
      currentDaySpend: String(currentDaySpend),
      currentMonthSpend: String(currentMonthSpend),
      updatedAt: new Date(),
    })
    .where(eq(budgetLimits.id, budget.id))

  const warningThreshold = budget.warningThresholdPercent || 80

  const monthlyBudgetUsd =
    budget.monthlyBudgetUsd !== null ? Number(budget.monthlyBudgetUsd) : null
  if (monthlyBudgetUsd !== null) {
    if (monthlyBudgetUsd === 0) {
      await createBudgetAlert(
        userId,
        "limit_reached",
        "monthly",
        100,
        currentMonthSpend,
        0,
        "Monthly budget set to $0 - provider blocked"
      )
    } else {
      const monthlyPercentage = (currentMonthSpend / monthlyBudgetUsd) * 100

      if (monthlyPercentage >= 100) {
        await createBudgetAlert(
          userId,
          "limit_reached",
          "monthly",
          100,
          currentMonthSpend,
          monthlyBudgetUsd,
          "Monthly budget limit has been reached"
        )
      } else if (monthlyPercentage >= warningThreshold) {
        await createBudgetAlert(
          userId,
          "warning",
          "monthly",
          Math.round(monthlyPercentage),
          currentMonthSpend,
          monthlyBudgetUsd,
          `Monthly budget is at ${Math.round(monthlyPercentage)}% of limit`
        )
      }
    }
  }

  const dailyBudgetUsd =
    budget.dailyBudgetUsd !== null ? Number(budget.dailyBudgetUsd) : null
  if (dailyBudgetUsd !== null) {
    if (dailyBudgetUsd === 0) {
      await createBudgetAlert(
        userId,
        "limit_reached",
        "daily",
        100,
        currentDaySpend,
        0,
        "Daily budget set to $0 - provider blocked"
      )
    } else {
      const dailyPercentage = (currentDaySpend / dailyBudgetUsd) * 100

      if (dailyPercentage >= 100) {
        await createBudgetAlert(
          userId,
          "limit_reached",
          "daily",
          100,
          currentDaySpend,
          dailyBudgetUsd,
          "Daily budget limit has been reached"
        )
      } else if (dailyPercentage >= warningThreshold) {
        await createBudgetAlert(
          userId,
          "warning",
          "daily",
          Math.round(dailyPercentage),
          currentDaySpend,
          dailyBudgetUsd,
          `Daily budget is at ${Math.round(dailyPercentage)}% of limit`
        )
      }
    }
  }
}

async function createBudgetAlert(
  userId: string,
  alertType: "warning" | "limit_reached" | "budget_exceeded",
  budgetType: "monthly" | "daily" | "per_chat",
  thresholdPercent: number,
  amountSpent: number,
  budgetLimit: number,
  message: string
): Promise<void> {
  const oneHourAgo = new Date()
  oneHourAgo.setHours(oneHourAgo.getHours() - 1)

  const recentAlerts = await db
    .select({ id: budgetAlerts.id })
    .from(budgetAlerts)
    .where(
      and(
        eq(budgetAlerts.userId, userId),
        eq(budgetAlerts.alertType, alertType),
        eq(budgetAlerts.budgetType, budgetType),
        gte(budgetAlerts.createdAt, oneHourAgo)
      )
    )
    .limit(1)

  if (recentAlerts.length > 0) {
    return
  }

  await db.insert(budgetAlerts).values({
    userId,
    alertType,
    budgetType,
    thresholdPercent,
    amountSpent: String(amountSpent),
    budgetLimit: String(budgetLimit),
    message,
  })
}
```

(The original's convoluted "update by provider_id, falling back to id" targeting logic is simplified to always `where(eq(budgetLimits.id, budget.id))` — strictly more precise since `id` alone already uniquely identifies the row; same behavior, less code.)

- [ ] **Step 4: Rewrite app/api/budget-alerts/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapBudgetAlertRow } from "@/lib/db/mappers"
import { budgetAlerts } from "@/lib/db/schema"
import { and, count, desc, eq, inArray } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")
    const unacknowledgedOnly = searchParams.get("unacknowledged") === "true"

    const conditions = [eq(budgetAlerts.userId, session.user.id)]
    if (unacknowledgedOnly) {
      conditions.push(eq(budgetAlerts.acknowledged, false))
    }
    const where = and(...conditions)

    const [data, totalRows] = await Promise.all([
      db
        .select()
        .from(budgetAlerts)
        .where(where)
        .orderBy(desc(budgetAlerts.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ value: count() }).from(budgetAlerts).where(where),
    ])

    return NextResponse.json({
      alerts: data.map(mapBudgetAlertRow),
      total: totalRows[0]?.value ?? 0,
    })
  } catch (err) {
    console.error("Error in budget-alerts GET:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { alertIds } = body

    if (!alertIds || !Array.isArray(alertIds)) {
      return NextResponse.json(
        { error: "Invalid alert IDs" },
        { status: 400 }
      )
    }

    await db
      .update(budgetAlerts)
      .set({ acknowledged: true })
      .where(
        and(
          eq(budgetAlerts.userId, session.user.id),
          inArray(budgetAlerts.id, alertIds)
        )
      )

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error in budget-alerts POST:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 5: Rewrite app/api/budget-limits/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapBudgetLimitRow } from "@/lib/db/mappers"
import { budgetLimits } from "@/lib/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const data = await db
      .select()
      .from(budgetLimits)
      .where(eq(budgetLimits.userId, session.user.id))
      .orderBy(asc(budgetLimits.providerId))

    return NextResponse.json({
      budgetLimits: data.map(mapBudgetLimitRow),
    })
  } catch (err) {
    console.error("Error in budget-limits GET:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { budgets } = body

    if (!Array.isArray(budgets) || budgets.length === 0) {
      return NextResponse.json(
        { error: "Invalid budget data" },
        { status: 400 }
      )
    }

    const results = []

    for (const budget of budgets) {
      const {
        provider_id,
        monthly_budget_usd,
        daily_budget_usd,
        per_chat_budget_usd,
        warning_threshold_percent,
        email_notifications,
        enforce_limits,
      } = budget

      const providerCondition = provider_id
        ? eq(budgetLimits.providerId, provider_id)
        : isNull(budgetLimits.providerId)

      const [existing] = await db
        .select({ id: budgetLimits.id })
        .from(budgetLimits)
        .where(and(eq(budgetLimits.userId, session.user.id), providerCondition))
        .limit(1)

      const values = {
        monthlyBudgetUsd:
          monthly_budget_usd !== undefined && monthly_budget_usd !== null
            ? String(monthly_budget_usd)
            : null,
        dailyBudgetUsd:
          daily_budget_usd !== undefined && daily_budget_usd !== null
            ? String(daily_budget_usd)
            : null,
        perChatBudgetUsd:
          per_chat_budget_usd !== undefined && per_chat_budget_usd !== null
            ? String(per_chat_budget_usd)
            : null,
        warningThresholdPercent: warning_threshold_percent,
        emailNotifications: email_notifications,
        enforceLimits: enforce_limits,
      }

      if (existing) {
        const [data] = await db
          .update(budgetLimits)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(budgetLimits.id, existing.id))
          .returning()

        results.push(mapBudgetLimitRow(data))
      } else {
        const [data] = await db
          .insert(budgetLimits)
          .values({
            userId: session.user.id,
            providerId: provider_id || null,
            ...values,
          })
          .returning()

        results.push(mapBudgetLimitRow(data))
      }
    }

    return NextResponse.json({
      budgetLimits: results,
    })
  } catch (err) {
    console.error("Error in budget-limits POST:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db
      .delete(budgetLimits)
      .where(eq(budgetLimits.userId, session.user.id))

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Error in budget-limits DELETE:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

(The original's `in_app_notifications` destructured field is dropped — `budget_limits` never had that column in `supabase/schema.sql` or the Drizzle schema; it was a dead field silently ignored by every insert/update even before this migration.)

- [ ] **Step 6: Rewrite app/api/budget-status/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapBudgetLimitRow } from "@/lib/db/mappers"
import { budgetLimits } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await db
      .select()
      .from(budgetLimits)
      .where(eq(budgetLimits.userId, session.user.id))

    if (rows.length === 0) {
      return NextResponse.json({
        hasBudget: false,
        budgetLimits: [],
        status: [],
      })
    }

    const now = new Date()
    const updatedRows = []

    for (const row of rows) {
      const updates: {
        currentDaySpend?: string
        dayReset?: Date
        currentMonthSpend?: string
        monthReset?: Date
        updatedAt?: Date
      } = {}

      const dayReset = row.dayReset ? new Date(row.dayReset) : null
      const isDayReset =
        !dayReset ||
        now.getUTCFullYear() !== dayReset.getUTCFullYear() ||
        now.getUTCMonth() !== dayReset.getUTCMonth() ||
        now.getUTCDate() !== dayReset.getUTCDate()

      if (isDayReset && Number(row.currentDaySpend ?? 0) > 0) {
        updates.currentDaySpend = "0"
        updates.dayReset = now
      }

      const monthReset = row.monthReset ? new Date(row.monthReset) : null
      const isMonthReset =
        !monthReset ||
        now.getUTCFullYear() !== monthReset.getUTCFullYear() ||
        now.getUTCMonth() !== monthReset.getUTCMonth()

      if (isMonthReset && Number(row.currentMonthSpend ?? 0) > 0) {
        updates.currentMonthSpend = "0"
        updates.monthReset = now
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now
        const [updated] = await db
          .update(budgetLimits)
          .set(updates)
          .where(eq(budgetLimits.id, row.id))
          .returning()
        updatedRows.push(updated)
      } else {
        updatedRows.push(row)
      }
    }

    const mapped = updatedRows.map(mapBudgetLimitRow)

    const statuses = mapped.map((row) => ({
      id: row.id,
      provider_id: row.provider_id,
      monthly: calculateBudgetStatus(
        row.current_month_spend,
        row.monthly_budget_usd,
        row.warning_threshold_percent
      ),
      daily: calculateBudgetStatus(
        row.current_day_spend,
        row.daily_budget_usd,
        row.warning_threshold_percent
      ),
    }))

    return NextResponse.json({
      hasBudget: true,
      budgetLimits: mapped,
      status: statuses,
    })
  } catch (err) {
    console.error("Error in budget-status GET:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

function calculateBudgetStatus(
  spent: number,
  limit: number | null,
  warningThreshold: number
) {
  if (!limit || limit === 0) {
    return {
      spent,
      limit: null,
      percentage: 0,
      isWarning: false,
      isExceeded: false,
    }
  }

  const percentage = (spent / limit) * 100

  return {
    spent,
    limit,
    percentage: Math.round(percentage * 100) / 100,
    isWarning: percentage >= warningThreshold && percentage < 100,
    isExceeded: percentage >= 100,
  }
}
```

- [ ] **Step 7: Rewrite app/api/model-usage/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats, modelUsage } from "@/lib/db/schema"
import { count, desc, eq, sum } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    const rows = await db
      .select({
        id: modelUsage.id,
        model_id: modelUsage.modelId,
        provider_id: modelUsage.providerId,
        input_tokens: modelUsage.inputTokens,
        output_tokens: modelUsage.outputTokens,
        total_tokens: modelUsage.totalTokens,
        input_cost_usd: modelUsage.inputCostUsd,
        output_cost_usd: modelUsage.outputCostUsd,
        total_cost_usd: modelUsage.totalCostUsd,
        created_at: modelUsage.createdAt,
        chat_id: modelUsage.chatId,
        chats: { title: chats.title },
      })
      .from(modelUsage)
      .leftJoin(chats, eq(modelUsage.chatId, chats.id))
      .where(eq(modelUsage.userId, session.user.id))
      .orderBy(desc(modelUsage.createdAt))
      .limit(limit)
      .offset(offset)

    const usage = rows.map((row) => ({
      ...row,
      input_cost_usd:
        row.input_cost_usd !== null ? Number(row.input_cost_usd) : null,
      output_cost_usd:
        row.output_cost_usd !== null ? Number(row.output_cost_usd) : null,
      total_cost_usd:
        row.total_cost_usd !== null ? Number(row.total_cost_usd) : null,
      created_at: row.created_at ? row.created_at.toISOString() : null,
    }))

    const [totalRow] = await db
      .select({ value: count() })
      .from(modelUsage)
      .where(eq(modelUsage.userId, session.user.id))

    const [sumRow] = await db
      .select({ value: sum(modelUsage.totalCostUsd) })
      .from(modelUsage)
      .where(eq(modelUsage.userId, session.user.id))

    return NextResponse.json({
      usage,
      total: totalRow?.value ?? 0,
      totalCost: sumRow?.value ? Number(sumRow.value) : 0,
    })
  } catch (err: unknown) {
    console.error("Error in model-usage API:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

(`row.chats` is expected to be `{ title: string | null }` when a matching chat exists, and `null` when the left join finds no row — e.g. a deleted chat — matching the frontend's `row.chats?.title` / `!row.original.chats` checks in `app/components/layout/settings/usage/usage-settings.tsx`. **Verify this at runtime before trusting it**: some Drizzle-orm versions return `{ title: null }` — a truthy object — for a nested `.select({ chats: { title } })` on a left-join miss, rather than `null` itself. If that's the case here, change the mapping to explicitly null it out: `chats: row.chat_id ? { title: row.chats?.title ?? null } : null` right before the `NextResponse.json` call.)

- [ ] **Step 8: Rewrite lib/models/custom.ts**

Replace the full file:

```ts
import "server-only"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { customModels } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { ModelConfig } from "./types"

export async function getCustomModels(): Promise<ModelConfig[]> {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) return []

    const rows = await db
      .select()
      .from(customModels)
      .where(eq(customModels.userId, session.user.id))

    return rows.map((m) => {
      const modelId = m.modelId.includes("/")
        ? m.modelId.split("/")[1]
        : m.modelId

      return {
        id: modelId,
        name: m.name,
        providerId: m.providerId,
        uniqueId: `${m.providerId}:${modelId}`,
        provider: m.providerId,
        icon: m.providerId,
        baseProviderId: m.providerId,
        contextWindow: m.contextWindow || 128000,
        inputCost: m.inputCost ? Number(m.inputCost) : 0,
        outputCost: m.outputCost ? Number(m.outputCost) : 0,
        vision: m.vision || false,
        tools: m.tools || false,
        reasoning: m.reasoning || false,
        audio: m.audio || false,
        video: m.video || false,
        baseUrl: m.baseUrl,
        isCustom: true,
        apiSdk: m.baseUrl
          ? async (apiKey?: string) => {
              const { createOpenAICompatible } = await import(
                "@ai-sdk/openai-compatible"
              )
              const instance = createOpenAICompatible({
                name: m.providerId,
                apiKey: apiKey,
                baseURL: m.baseUrl!,
              })
              return instance(modelId)
            }
          : async (apiKey?: string) => {
              const { getRawModelsDevAPI } = await import(
                "../providers/registry"
              )
              const providersData = (await getRawModelsDevAPI()) as any
              const providerInfo = providersData[m.providerId]

              if (!providerInfo) {
                throw new Error(
                  `Provider ${m.providerId} not found. Custom models without a base URL must use a known provider.`
                )
              }

              const { createModelSDK } = await import("./sdk")
              return await createModelSDK(
                {
                  id: m.providerId,
                  npm: providerInfo.npm,
                  api: providerInfo.api,
                },
                modelId,
                apiKey
              )
            },
      }
    })
  } catch (error) {
    console.warn("Failed to load custom models:", error)
    return []
  }
}
```

- [ ] **Step 9: Rewrite app/api/custom-models/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { customModels } from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await db
    .select()
    .from(customModels)
    .where(eq(customModels.userId, session.user.id))
    .orderBy(desc(customModels.createdAt))

  return NextResponse.json({ customModels: data })
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const {
    name,
    modelId,
    providerId,
    baseUrl,
    contextWindow,
    inputCost,
    outputCost,
    vision,
    tools,
    reasoning,
    audio,
    video,
  } = body

  if (!name || !modelId || !providerId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  try {
    const [data] = await db
      .insert(customModels)
      .values({
        userId: session.user.id,
        name,
        modelId,
        providerId,
        baseUrl,
        contextWindow,
        inputCost: inputCost !== undefined ? String(inputCost) : undefined,
        outputCost: outputCost !== undefined ? String(outputCost) : undefined,
        vision: vision || false,
        tools: tools || false,
        reasoning: reasoning || false,
        audio: audio || false,
        video: video || false,
      })
      .returning()

    return NextResponse.json({ customModel: data })
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json(
        { error: "A custom model with this ID already exists" },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing model ID" }, { status: 400 })
  }

  const body = await request.json()
  const {
    name,
    modelId,
    providerId,
    baseUrl,
    contextWindow,
    inputCost,
    outputCost,
    vision,
    tools,
    reasoning,
    audio,
    video,
  } = body

  if (!name || !modelId || !providerId) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    )
  }

  const [data] = await db
    .update(customModels)
    .set({
      name,
      modelId,
      providerId,
      baseUrl,
      contextWindow,
      inputCost: inputCost !== undefined ? String(inputCost) : undefined,
      outputCost: outputCost !== undefined ? String(outputCost) : undefined,
      vision: vision || false,
      tools: tools || false,
      reasoning: reasoning || false,
      audio: audio || false,
      video: video || false,
      updatedAt: new Date(),
    })
    .where(
      and(eq(customModels.id, id), eq(customModels.userId, session.user.id))
    )
    .returning()

  if (!data) {
    return NextResponse.json({ error: "Model not found" }, { status: 404 })
  }

  return NextResponse.json({ customModel: data })
}

export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")

  if (!id) {
    return NextResponse.json({ error: "Missing model ID" }, { status: 400 })
  }

  await db
    .delete(customModels)
    .where(
      and(eq(customModels.id, id), eq(customModels.userId, session.user.id))
    )

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 10: Update app/api/providers/route.ts's auth check**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { getEffectiveApiKey, ProviderWithoutOllama } from "@/lib/user-keys"
import { NextRequest, NextResponse } from "next/server"
import { getAllModels } from "@/lib/models"
import { ensureProviderLogosCached } from "@/lib/server/provider-logos"
import { headers } from "next/headers"

export async function GET() {
  try {
    const models = await getAllModels()

    const map = new Map<
      string,
      { id: string; name: string; logoUrl?: string; count: number }
    >()
    for (const m of models) {
      const id = m.providerId
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: m.provider,
          logoUrl: m.logoUrl,
          count: 1,
        })
      } else {
        const entry = map.get(id)!
        entry.count += 1
      }
    }

    const providers = Array.from(map.values()).sort((a, b) => b.count - a.count)

    await ensureProviderLogosCached(providers.map((p) => p.id))
    return NextResponse.json({ providers })
  } catch (error) {
    console.error("Error listing providers:", error)
    return NextResponse.json(
      { error: "Failed to list providers" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { provider, userId } = await request.json()

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user || session.user.id !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (provider === "ollama") {
      return NextResponse.json({
        hasUserKey: false,
        provider,
      })
    }

    const apiKey = await getEffectiveApiKey(
      userId,
      provider as ProviderWithoutOllama
    )

    return NextResponse.json({
      hasUserKey: !!apiKey,
      provider,
    })
  } catch (error) {
    console.error("Error checking provider keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 11: Update app/api/models/route.ts's user-keys lookup**

Replace the full file:

```ts
import {
  getAllModels,
  getModelsForUserProviders,
  refreshModelsCache,
} from "@/lib/models"
import { getCustomModels } from "@/lib/models/custom"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userKeys } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { ensureProviderLogosCached } from "@/lib/server/provider-logos"

async function respondWithModels(models: any[]) {
  await ensureProviderLogosCached(
    Array.from(new Set(models.map((m) => m.providerId)))
  )
  return new Response(JSON.stringify({ models }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (!session?.user) {
      const models = await getAllModels()
      return respondWithModels(models)
    }

    const customModelsResult = await getCustomModels()
    const customModels = customModelsResult?.length
      ? customModelsResult
      : undefined

    const rows = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(eq(userKeys.userId, session.user.id))

    const userProviders = rows.map((k) => k.provider)

    if (userProviders.length === 0) {
      const models = await getAllModels(customModels)
      return respondWithModels(models)
    }

    const models = await getModelsForUserProviders(userProviders, customModels)
    return respondWithModels(models)
  } catch (error) {
    console.error("Error fetching models:", error)
    return new Response(JSON.stringify({ error: "Failed to fetch models" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}

export async function POST() {
  try {
    refreshModelsCache()
    const customModels = await getCustomModels()
    const models = await getAllModels(customModels)

    return NextResponse.json({
      message: "Models cache refreshed",
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    })
  } catch (error) {
    console.error("Failed to refresh models:", error)
    return NextResponse.json(
      { error: "Failed to refresh models" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 12: Delete the dead lib/models/route.ts**

Run: `rm lib/models/route.ts`
Expected: file removed; `grep -rn "lib/models/route" --include="*.ts" --include="*.tsx" .` (excluding `node_modules`) returns nothing.

- [ ] **Step 13: Type-check**

Run: `npm run type-check`
Expected: no errors from any file touched in this task or Task 5. Errors from Task 7's not-yet-migrated files (`lib/user-keys.ts`, `lib/mcp-store/*`, projects/user-preferences routes) are still expected.

- [ ] **Step 14: Commit**

```bash
git add lib/db/mappers.ts lib/usage.ts lib/budget.ts app/api/budget-alerts app/api/budget-limits app/api/budget-status app/api/model-usage lib/models/custom.ts app/api/custom-models app/api/providers app/api/models
git rm lib/models/route.ts
git commit -m "feat: migrate budget, usage, and custom-model persistence to Drizzle"
```

---

### Task 7: Projects, user-keys, preferences, feedback, MCP DB migration

**Design note:** Same conventions as Tasks 5-6 (no `supabase` param, session via `auth.api.getSession`, explicit `updatedAt: new Date()` on every UPDATE since Postgres triggers weren't ported, snake_case JSON responses via mappers). Two more browser-direct-to-Supabase call sites surfaced during this task's research that weren't in the original file inventory: `lib/mcp-store/supabase.ts` (MCP server CRUD, called from the client-side `useMCPStore` zustand store) and the `feedback` table writes in `components/common/feedback-form.tsx` / `components/common/model-selector/pro-dialog.tsx` — both need new API routes for the same reason chats/messages did (Task 5): no browser-safe Drizzle client. Also folded in here: `app/api/toggle-chat-pin/route.ts` and `app/api/update-chat-model/route.ts`, two small existing routes that `lib/chat-store/chats/api.ts` (Task 5) already calls via `fetchClient` but which were missed from Task 5's file list — both also had no ownership check on their `chats` UPDATE (same pre-existing gap fixed elsewhere in Task 5).

**Files:**
- Modify: `lib/db/mappers.ts` (append `mapMcpServerRow`, `mapProjectRow`)
- Modify: `lib/user-keys.ts`
- Modify: `app/api/user-keys/route.ts`
- Modify: `app/api/user-key-status/route.ts`
- Modify: `app/api/user-preferences/route.ts`
- Modify: `app/api/user-preferences/favorite-models/route.ts`
- Modify: `app/api/projects/route.ts`
- Modify: `app/api/projects/[projectId]/route.ts`
- Modify: `app/api/toggle-chat-pin/route.ts`
- Modify: `app/api/update-chat-model/route.ts`
- Create: `app/api/mcp-servers/route.ts`
- Create: `app/api/mcp-servers/[id]/route.ts`
- Rename+Modify: `lib/mcp-store/supabase.ts` → `lib/mcp-store/api.ts`
- Modify: `lib/mcp-store/index.ts`
- Modify: `lib/mcp-store/store.ts`
- Create: `app/api/feedback/route.ts`
- Modify: `components/common/feedback-form.tsx`
- Modify: `components/common/model-selector/pro-dialog.tsx`

**Interfaces:**
- Consumes: `db`, `userKeys`, `userPreferences`, `projects`, `mcpServers`, `feedback`, `users` from `@/lib/db/schema`; `auth` from `@/lib/auth`.
- Produces: `mapMcpServerRow(row)`, `mapProjectRow(row)` (`@/lib/db/mappers`). `getUserKey(userId, provider)`, `getEffectiveApiKey(userId, provider)` (`@/lib/user-keys`) — same signatures Task 5's `app/api/chat/route.ts` already calls. MCP CRUD functions in `lib/mcp-store/api.ts` keep the exact names/signatures `lib/mcp-store/store.ts` already imports (`readMCPServersFromSupabase`, `addMCPServerToSupabase`, `updateMCPServerInSupabase`, `deleteMCPServerFromSupabase`, `clearAllMCPServersInSupabase`) so `store.ts` needs only an import-path change, not a rewrite.

- [ ] **Step 1: Extend the DB mappers with MCP server and project row mappers**

Append to `lib/db/mappers.ts`:

```ts
import type { MCPServerConfig } from "@/lib/mcp-store/types"

export function mapMcpServerRow(row: McpServer): MCPServerConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    enabled: row.enabled ?? false,
    transportType: row.transportType as "http" | "sse",
    url: row.url || undefined,
    headers: (row.headers as Record<string, string>) || undefined,
    createdAt: row.createdAt
      ? row.createdAt.toISOString()
      : new Date().toISOString(),
    updatedAt: row.updatedAt
      ? row.updatedAt.toISOString()
      : new Date().toISOString(),
  }
}

export function mapProjectRow(row: Project) {
  return {
    id: row.id,
    name: row.name,
    user_id: row.userId,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
  }
}
```

Update the top-of-file type import line to also include `McpServer` and `Project`:

```ts
import type {
  BudgetAlert,
  BudgetLimit,
  Chat,
  McpServer,
  Message,
  NewUser,
  Project,
  User,
} from "@/lib/db/schema"
```

- [ ] **Step 2: Rewrite lib/user-keys.ts**

Replace the full file:

```ts
import "server-only"
import { db } from "@/lib/db/client"
import { userKeys } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { decryptKey } from "./encryption"

export type Provider = string
export type ProviderWithoutOllama = string

export async function getUserKey(
  userId: string,
  provider: Provider
): Promise<string | null> {
  try {
    const [row] = await db
      .select({ encryptedKey: userKeys.encryptedKey, iv: userKeys.iv })
      .from(userKeys)
      .where(
        and(eq(userKeys.userId, userId), eq(userKeys.provider, provider))
      )
      .limit(1)

    if (!row) return null

    return decryptKey(row.encryptedKey, row.iv)
  } catch (error) {
    console.error("Error retrieving user key:", error)
    return null
  }
}

export async function getEffectiveApiKey(
  userId: string | null,
  provider: ProviderWithoutOllama
): Promise<string | null> {
  if (!userId) return null

  return await getUserKey(userId, provider)
}
```

- [ ] **Step 3: Rewrite app/api/user-keys/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userKeys, users } from "@/lib/db/schema"
import { encryptKey } from "@/lib/encryption"
import { getModelsForProvider } from "@/lib/models"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json()

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: "Provider and API key are required" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { encrypted, iv } = encryptKey(apiKey)

    const [existingKey] = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(
        and(
          eq(userKeys.userId, session.user.id),
          eq(userKeys.provider, provider)
        )
      )
      .limit(1)

    const isNewKey = !existingKey

    await db
      .insert(userKeys)
      .values({
        userId: session.user.id,
        provider,
        encryptedKey: encrypted,
        iv,
      })
      .onConflictDoUpdate({
        target: [userKeys.userId, userKeys.provider],
        set: { encryptedKey: encrypted, iv, updatedAt: new Date() },
      })

    if (isNewKey) {
      try {
        const [userData] = await db
          .select({ favoriteModels: users.favoriteModels })
          .from(users)
          .where(eq(users.id, session.user.id))
          .limit(1)

        const currentFavorites = userData?.favoriteModels || []

        const providerModels = await getModelsForProvider(provider)
        if (!providerModels || providerModels.length === 0) {
          return NextResponse.json({
            success: true,
            isNewKey,
            message: "API key saved",
          })
        }
        const mostRecent = providerModels
          .slice()
          .sort((a, b) => {
            const ta = a.updatedAt || a.releasedAt || ""
            const tb = b.updatedAt || b.releasedAt || ""
            return (tb || "").localeCompare(ta || "")
          })[0]

        if (mostRecent && !currentFavorites.includes(mostRecent.id)) {
          await db
            .update(users)
            .set({ favoriteModels: [...currentFavorites, mostRecent.id] })
            .where(eq(users.id, session.user.id))
        }
      } catch (modelsError) {
        console.error("Failed to update favorite models:", modelsError)
      }
    }

    return NextResponse.json({
      success: true,
      isNewKey,
      message: isNewKey
        ? `API key saved and ${provider} models added to favorites`
        : "API key updated",
    })
  } catch (error) {
    console.error("Error in POST /api/user-keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { provider } = await request.json()

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db
      .delete(userKeys)
      .where(
        and(
          eq(userKeys.userId, session.user.id),
          eq(userKeys.provider, provider)
        )
      )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in DELETE /api/user-keys:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 4: Rewrite app/api/user-key-status/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userKeys } from "@/lib/db/schema"
import { getAllModels } from "@/lib/models"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const rows = await db
      .select({ provider: userKeys.provider })
      .from(userKeys)
      .where(eq(userKeys.userId, session.user.id))

    const models = await getAllModels()
    const dynamicProviders = new Set<string>(models.map((m) => m.providerId))

    const userProviders = new Set<string>(rows.map((k) => k.provider))
    const providerStatus: Record<string, boolean> = {}
    for (const id of dynamicProviders) {
      providerStatus[id] = userProviders.has(id)
    }
    for (const id of userProviders) {
      providerStatus[id] = true
    }

    return NextResponse.json(providerStatus)
  } catch (err) {
    console.error("Key status error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 5: Rewrite app/api/user-preferences/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { userPreferences } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, session.user.id))
      .limit(1)

    if (!data) {
      return NextResponse.json({
        layout: "fullscreen",
        prompt_suggestions: true,
        show_tool_invocations: true,
        show_conversation_previews: true,
        multi_model_enabled: false,
        hidden_models: [],
      })
    }

    return NextResponse.json({
      layout: data.layout,
      prompt_suggestions: data.promptSuggestions,
      show_tool_invocations: data.showToolInvocations,
      show_conversation_previews: data.showConversationPreviews,
      multi_model_enabled: data.multiModelEnabled,
      hidden_models: data.hiddenModels || [],
    })
  } catch (error) {
    console.error("Error in user-preferences GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      layout,
      prompt_suggestions,
      show_tool_invocations,
      show_conversation_previews,
      multi_model_enabled,
      hidden_models,
    } = body

    if (layout && typeof layout !== "string") {
      return NextResponse.json(
        { error: "layout must be a string" },
        { status: 400 }
      )
    }

    if (hidden_models && !Array.isArray(hidden_models)) {
      return NextResponse.json(
        { error: "hidden_models must be an array" },
        { status: 400 }
      )
    }

    const updateData: {
      layout?: string
      promptSuggestions?: boolean
      showToolInvocations?: boolean
      showConversationPreviews?: boolean
      multiModelEnabled?: boolean
      hiddenModels?: string[]
    } = {}
    if (layout !== undefined) updateData.layout = layout
    if (prompt_suggestions !== undefined)
      updateData.promptSuggestions = prompt_suggestions
    if (show_tool_invocations !== undefined)
      updateData.showToolInvocations = show_tool_invocations
    if (show_conversation_previews !== undefined)
      updateData.showConversationPreviews = show_conversation_previews
    if (multi_model_enabled !== undefined)
      updateData.multiModelEnabled = multi_model_enabled
    if (hidden_models !== undefined) updateData.hiddenModels = hidden_models

    const [data] = await db
      .insert(userPreferences)
      .values({ userId: session.user.id, ...updateData })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...updateData, updatedAt: new Date() },
      })
      .returning()

    return NextResponse.json({
      success: true,
      layout: data.layout,
      prompt_suggestions: data.promptSuggestions,
      show_tool_invocations: data.showToolInvocations,
      show_conversation_previews: data.showConversationPreviews,
      multi_model_enabled: data.multiModelEnabled,
      hidden_models: data.hiddenModels || [],
    })
  } catch (error) {
    console.error("Error in user-preferences PUT API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 6: Rewrite app/api/user-preferences/favorite-models/route.ts**

Replace the full file:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { favorite_models } = body

    if (!Array.isArray(favorite_models)) {
      return NextResponse.json(
        { error: "favorite_models must be an array" },
        { status: 400 }
      )
    }

    if (!favorite_models.every((model) => typeof model === "string")) {
      return NextResponse.json(
        { error: "All favorite_models must be strings" },
        { status: 400 }
      )
    }

    const [data] = await db
      .update(users)
      .set({ favoriteModels: favorite_models })
      .where(eq(users.id, session.user.id))
      .returning({ favoriteModels: users.favoriteModels })

    return NextResponse.json({
      success: true,
      favorite_models: data.favoriteModels,
    })
  } catch (error) {
    console.error("Error in favorite-models API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .select({ favoriteModels: users.favoriteModels })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1)

    return NextResponse.json({
      favorite_models: data?.favoriteModels || [],
    })
  } catch (error) {
    console.error("Error in favorite-models GET API:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 7: Rewrite app/api/projects/route.ts and app/api/projects/[projectId]/route.ts**

Replace the full contents of `app/api/projects/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapProjectRow } from "@/lib/db/mappers"
import { projects } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name } = await request.json()

    const [data] = await db
      .insert(projects)
      .values({ name, userId: session.user.id })
      .returning()

    return NextResponse.json(mapProjectRow(data))
  } catch (err: unknown) {
    console.error("Error in projects endpoint:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const data = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, session.user.id))
    .orderBy(asc(projects.createdAt))

  return NextResponse.json(data.map(mapProjectRow))
}
```

Replace the full contents of `app/api/projects/[projectId]/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapProjectRow } from "@/lib/db/mappers"
import { projects } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .select()
      .from(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .limit(1)

    if (!data) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (err: unknown) {
    console.error("Error in project endpoint:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [data] = await db
      .update(projects)
      .set({ name: name.trim() })
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .returning()

    if (!data) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(mapProjectRow(data))
  } catch (err: unknown) {
    console.error("Error updating project:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const result = await db
      .delete(projects)
      .where(
        and(eq(projects.id, projectId), eq(projects.userId, session.user.id))
      )
      .returning({ id: projects.id })

    if (result.length === 0) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    console.error("Error deleting project:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
```

(Project deletion cascade-deletes related chats via the `chats.projectId` FK's `onDelete: "set null"` — matching the original comment, which was actually slightly wrong: `supabase/schema.sql`'s `chats.project_id` FK is `on delete set null`, not cascade, so deleting a project un-links its chats rather than deleting them. The Drizzle schema (Task 2) preserves this — chats survive project deletion, project field just goes to `null`.)

- [ ] **Step 8: Fix ownership checks on toggle-chat-pin and update-chat-model**

Replace the full contents of `app/api/toggle-chat-pin/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { chatId, pinned } = await request.json()

    if (!chatId || typeof pinned !== "boolean") {
      return NextResponse.json(
        { error: "Missing chatId or pinned" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const toggle = pinned
      ? { pinned: true, pinnedAt: new Date() }
      : { pinned: false, pinnedAt: null }

    await db
      .update(chats)
      .set({ ...toggle, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("toggle-chat-pin unhandled error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

Replace the full contents of `app/api/update-chat-model/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { chats } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { chatId, model } = await request.json()

    if (!chatId || !model) {
      return NextResponse.json(
        { error: "Missing chatId or model" },
        { status: 400 }
      )
    }

    const session = await auth.api.getSession({ headers: await headers() })
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await db
      .update(chats)
      .set({ model, updatedAt: new Date() })
      .where(and(eq(chats.id, chatId), eq(chats.userId, session.user.id)))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err: unknown) {
    console.error("Error in update-chat-model endpoint:", err)
    return NextResponse.json(
      { error: (err as Error).message || "Internal server error" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 9: Create the MCP servers API routes**

Create `app/api/mcp-servers/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mapMcpServerRow } from "@/lib/db/mappers"
import { mcpServers } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ servers: [] })
  }

  const rows = await db
    .select()
    .from(mcpServers)
    .where(eq(mcpServers.userId, session.user.id))
    .orderBy(desc(mcpServers.createdAt))

  return NextResponse.json({ servers: rows.map(mapMcpServerRow) })
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()

  const [row] = await db
    .insert(mcpServers)
    .values({
      userId: session.user.id,
      name: body.name,
      description: body.description || null,
      enabled: body.enabled,
      transportType: body.transportType,
      url: body.url || null,
      headers: body.headers || null,
    })
    .returning()

  return NextResponse.json({ server: mapMcpServerRow(row) })
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db.delete(mcpServers).where(eq(mcpServers.userId, session.user.id))

  return NextResponse.json({ success: true })
}
```

Create `app/api/mcp-servers/[id]/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { mcpServers } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const updates = await request.json()
  const values: {
    name?: string
    description?: string | null
    enabled?: boolean
    transportType?: string
    url?: string | null
    headers?: unknown
    updatedAt: Date
  } = { updatedAt: new Date() }
  if (updates.name !== undefined) values.name = updates.name
  if (updates.description !== undefined)
    values.description = updates.description || null
  if (updates.enabled !== undefined) values.enabled = updates.enabled
  if (updates.transportType !== undefined)
    values.transportType = updates.transportType
  if (updates.url !== undefined) values.url = updates.url || null
  if (updates.headers !== undefined) values.headers = updates.headers || null

  const result = await db
    .update(mcpServers)
    .set(values)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, session.user.id)))
    .returning({ id: mcpServers.id })

  if (result.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  await db
    .delete(mcpServers)
    .where(and(eq(mcpServers.id, id), eq(mcpServers.userId, session.user.id)))

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 10: Replace lib/mcp-store/supabase.ts with lib/mcp-store/api.ts**

Run: `git mv lib/mcp-store/supabase.ts lib/mcp-store/api.ts`

Replace the full contents of `lib/mcp-store/api.ts`:

```ts
import { fetchClient } from "@/lib/fetch"
import type { MCPServerConfig } from "./types"

/**
 * Server-backed persistence for MCP servers (via app/api/mcp-servers),
 * used instead of IndexedDB for authenticated users.
 */

export async function readMCPServersFromSupabase(
  userId: string
): Promise<MCPServerConfig[]> {
  if (!userId) return []
  try {
    const res = await fetchClient("/api/mcp-servers")
    if (!res.ok) return []
    const { servers } = await res.json()
    return servers
  } catch (error) {
    console.error("Error reading MCP servers:", error)
    return []
  }
}

export async function addMCPServerToSupabase(
  userId: string,
  server: Omit<MCPServerConfig, "id" | "createdAt" | "updatedAt">
): Promise<MCPServerConfig | null> {
  try {
    const res = await fetchClient("/api/mcp-servers", {
      method: "POST",
      body: JSON.stringify(server),
    })
    if (!res.ok) return null
    const { server: created } = await res.json()
    return created
  } catch (error) {
    console.error("Error adding MCP server:", error)
    return null
  }
}

export async function updateMCPServerInSupabase(
  id: string,
  updates: Partial<Omit<MCPServerConfig, "id" | "createdAt" | "updatedAt">>
): Promise<boolean> {
  try {
    const res = await fetchClient(`/api/mcp-servers/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    })
    return res.ok
  } catch (error) {
    console.error("Error updating MCP server:", error)
    return false
  }
}

export async function deleteMCPServerFromSupabase(
  id: string
): Promise<boolean> {
  try {
    const res = await fetchClient(`/api/mcp-servers/${id}`, {
      method: "DELETE",
    })
    return res.ok
  } catch (error) {
    console.error("Error deleting MCP server:", error)
    return false
  }
}

export async function clearAllMCPServersInSupabase(
  userId: string
): Promise<boolean> {
  try {
    const res = await fetchClient("/api/mcp-servers", { method: "DELETE" })
    return res.ok
  } catch (error) {
    console.error("Error clearing MCP servers:", error)
    return false
  }
}
```

(Function names keep the `...Supabase` suffix even though the backend changed — renaming them would also require updating every call site in `lib/mcp-store/store.ts`, which is unnecessary churn; the file rename to `api.ts` already signals the backend change at the module level.)

In `lib/mcp-store/index.ts`, change:
```ts
export * from "./supabase"
```
to:
```ts
export * from "./api"
```

In `lib/mcp-store/store.ts`, change the import:
```ts
import {
  readMCPServersFromSupabase,
  addMCPServerToSupabase,
  updateMCPServerInSupabase,
  deleteMCPServerFromSupabase,
  clearAllMCPServersInSupabase,
} from "./supabase"
```
to:
```ts
import {
  readMCPServersFromSupabase,
  addMCPServerToSupabase,
  updateMCPServerInSupabase,
  deleteMCPServerFromSupabase,
  clearAllMCPServersInSupabase,
} from "./api"
```

No other lines in `store.ts` change — every function call keeps its existing name.

- [ ] **Step 11: Create the feedback API route and rewire its two client components**

Create `app/api/feedback/route.ts`:

```ts
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/client"
import { feedback } from "@/lib/db/schema"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { message } = await request.json()
  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    )
  }

  await db.insert(feedback).values({
    userId: session.user.id,
    message,
  })

  return NextResponse.json({ success: true })
}
```

In `components/common/feedback-form.tsx`: remove the `createClient` and `isSupabaseEnabled` imports and the `if (!isSupabaseEnabled) return null` guard, and replace the submit body:

```ts
      const res = await fetchClient("/api/feedback", {
        method: "POST",
        body: JSON.stringify({ message: feedback }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        toast({
          title: `Error submitting feedback: ${error}`,
          status: "error",
        })
        setStatus("error")
        return
      }
```

replacing the old `const supabase = createClient(); if (!supabase) {...}; const { error } = await supabase.from("feedback").insert({...})` block, and add `import { fetchClient } from "@/lib/fetch"` to the top-of-file imports in place of the two removed Supabase imports.

In `components/common/model-selector/pro-dialog.tsx`: remove the `createClient` import, and replace the `mutationFn` body:

```ts
    mutationFn: async () => {
      if (!user?.id) throw new Error("Missing user")

      const res = await fetchClient("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          message: `I want access to ${currentModel}`,
        }),
      })

      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error || "Failed to submit feedback")
      }
    },
```

adding `import { fetchClient } from "@/lib/fetch"` to the top-of-file imports in place of the removed Supabase import.

- [ ] **Step 12: Type-check**

Run: `npm run type-check`
Expected: no errors from any file touched in Tasks 5, 6, or 7. Remaining errors, if any, should only come from files not yet touched by this plan (storage in Task 8, cleanup targets in Task 9).

- [ ] **Step 13: Commit**

```bash
git add lib/db/mappers.ts lib/user-keys.ts app/api/user-keys app/api/user-key-status app/api/user-preferences app/api/projects app/api/toggle-chat-pin app/api/update-chat-model app/api/mcp-servers lib/mcp-store app/api/feedback components/common/feedback-form.tsx components/common/model-selector/pro-dialog.tsx
git commit -m "feat: migrate projects, user-keys, preferences, feedback, and MCP servers to Drizzle"
```

---
