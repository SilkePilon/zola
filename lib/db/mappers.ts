import type { NewUser, User, UserPreference } from "@/lib/db/schema"

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
