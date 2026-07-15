import { USER_PROFILE_ROW_ID } from "./general/user-profile"
import { ACCOUNT_MANAGEMENT_ROW_ID } from "./general/account-management"
import { HISTORY_MANAGEMENT_ROW_ID } from "./general/history-management"
import { SYSTEM_PROMPT_ROW_ID } from "./general/system-prompt"
import { THEME_SELECTION_ROW_ID } from "./appearance/theme-selection"
import { LAYOUT_SETTINGS_ROW_ID } from "./appearance/layout-settings"
import {
  PROMPT_SUGGESTIONS_ROW_ID,
  TOOL_INVOCATIONS_ROW_ID,
  CONVERSATION_PREVIEWS_ROW_ID,
  MULTI_MODEL_ROW_ID,
} from "./appearance/interaction-preferences"

export type TabType =
  | "general"
  | "appearance"
  | "prompts"
  | "apikeys"
  | "models"
  | "connections"
  | "mcp"
  | "usage"
  | "budget"

export const SECTION_IDS = {
  apikeys: "settings-section-apikeys",
  models: "settings-section-models",
  connections: "settings-section-connections",
  mcp: "settings-section-mcp",
  usage: "settings-section-usage",
  budget: "settings-section-budget",
} as const satisfies Record<string, string>

export type SettingsSearchEntry = {
  tab: TabType
  rowId: string
  label: string
  description?: string
}

export const SETTINGS_SEARCH_INDEX: SettingsSearchEntry[] = [
  { tab: "general", rowId: USER_PROFILE_ROW_ID, label: "Profile", description: "Avatar, name, email" },
  { tab: "general", rowId: ACCOUNT_MANAGEMENT_ROW_ID, label: "Account", description: "Sign out of this device" },
  { tab: "general", rowId: HISTORY_MANAGEMENT_ROW_ID, label: "History", description: "Clear chat history" },
  { tab: "prompts", rowId: SYSTEM_PROMPT_ROW_ID, label: "Default system prompt" },
  { tab: "appearance", rowId: THEME_SELECTION_ROW_ID, label: "Appearance", description: "Light, dark, or system theme" },
  { tab: "appearance", rowId: LAYOUT_SETTINGS_ROW_ID, label: "Layout", description: "Sidebar or fullscreen layout" },
  { tab: "appearance", rowId: PROMPT_SUGGESTIONS_ROW_ID, label: "Prompt suggestions" },
  { tab: "appearance", rowId: TOOL_INVOCATIONS_ROW_ID, label: "Tool invocations" },
  { tab: "appearance", rowId: CONVERSATION_PREVIEWS_ROW_ID, label: "Conversation previews" },
  { tab: "appearance", rowId: MULTI_MODEL_ROW_ID, label: "Multi-model chat" },
  { tab: "apikeys", rowId: SECTION_IDS.apikeys, label: "API Keys", description: "Bring your own provider keys" },
  { tab: "models", rowId: SECTION_IDS.models, label: "Models", description: "Favorites, visibility, custom models" },
  { tab: "connections", rowId: SECTION_IDS.connections, label: "Connections", description: "Ollama and developer tools" },
  { tab: "mcp", rowId: SECTION_IDS.mcp, label: "MCP Servers" },
  { tab: "usage", rowId: SECTION_IDS.usage, label: "Usage & Cost" },
  { tab: "budget", rowId: SECTION_IDS.budget, label: "Budget" },
]

export function searchSettingsIndex(query: string): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return SETTINGS_SEARCH_INDEX.filter((entry) => {
    const haystack = `${entry.label} ${entry.description ?? ""} ${entry.tab}`.toLowerCase()
    return haystack.includes(q)
  })
}
