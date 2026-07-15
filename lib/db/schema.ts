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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    index("idx_model_usage_model_provider").on(table.modelId, table.providerId),
  ]
)

export const budgetLimits = pgTable(
  "budget_limits",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
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
