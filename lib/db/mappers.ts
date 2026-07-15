import type {
  BudgetAlert,
  BudgetLimit,
  Chat,
  CustomModel,
  McpServer,
  Message,
  NewUser,
  Project,
  User,
  UserPreference,
} from "@/lib/db/schema"
import type { MCPServerConfig } from "@/lib/mcp-store/types"

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

/**
 * Maps a Drizzle `userPreferences` row (camelCase JS property names, e.g.
 * `promptSuggestions`) to the snake_case shape `convertFromApiFormat`
 * (`@/lib/user-preference-store/utils`) expects. Without this, the field
 * names don't line up and every preference silently falls back to its
 * default value on every profile fetch.
 */
export function mapUserPreferencesRow(row: UserPreference) {
  return {
    layout: row.layout,
    prompt_suggestions: row.promptSuggestions,
    show_tool_invocations: row.showToolInvocations,
    show_conversation_previews: row.showConversationPreviews,
    multi_model_enabled: row.multiModelEnabled,
    hidden_models: row.hiddenModels,
  }
}

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

/**
 * Maps a Drizzle `customModels` row (camelCase, decimal columns as strings)
 * to the snake_case shape `app/components/layout/settings/models/
 * models-settings.tsx`'s `CustomModel` type and `add-custom-model-dialog.tsx`
 * expect (`model_id`, `provider_id`, `input_cost` as number, `created_at` as
 * ISO string, etc). Not in Task 6's brief — found while checking whether the
 * brief's raw-row `NextResponse.json({ customModels: data })` response would
 * break this consumer; without this mapper every custom model row silently
 * mismatches field names in the settings UI.
 */
export function mapCustomModelRow(row: CustomModel) {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    model_id: row.modelId,
    provider_id: row.providerId,
    base_url: row.baseUrl,
    context_window: row.contextWindow,
    input_cost: row.inputCost !== null ? Number(row.inputCost) : null,
    output_cost: row.outputCost !== null ? Number(row.outputCost) : null,
    vision: row.vision ?? false,
    tools: row.tools ?? false,
    reasoning: row.reasoning ?? false,
    audio: row.audio ?? false,
    video: row.video ?? false,
    created_at: row.createdAt ? row.createdAt.toISOString() : null,
    updated_at: row.updatedAt ? row.updatedAt.toISOString() : null,
  }
}

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
