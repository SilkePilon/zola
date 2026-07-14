"use client"

import { Switch } from "@/components/ui/switch"
import { useUserPreferences } from "@/lib/user-preference-store/provider"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const PROMPT_SUGGESTIONS_ROW_ID = "settings-row-appearance-prompt-suggestions"
export const TOOL_INVOCATIONS_ROW_ID = "settings-row-appearance-tool-invocations"
export const CONVERSATION_PREVIEWS_ROW_ID = "settings-row-appearance-conversation-previews"
export const MULTI_MODEL_ROW_ID = "settings-row-appearance-multi-model"

export function InteractionPreferences() {
  const {
    preferences,
    setPromptSuggestions,
    setShowToolInvocations,
    setShowConversationPreviews,
    setMultiModelEnabled,
  } = useUserPreferences()

  return (
    <SettingsSection title="Behavior">
      <SettingsRow
        id={PROMPT_SUGGESTIONS_ROW_ID}
        title="Prompt suggestions"
        description="Show suggested prompts when starting a new conversation."
      >
        <Switch
          checked={preferences.promptSuggestions}
          onCheckedChange={setPromptSuggestions}
        />
      </SettingsRow>
      <SettingsRow
        id={TOOL_INVOCATIONS_ROW_ID}
        title="Tool invocations"
        description="Show tool execution details in conversations."
      >
        <Switch
          checked={preferences.showToolInvocations}
          onCheckedChange={setShowToolInvocations}
        />
      </SettingsRow>
      <SettingsRow
        id={CONVERSATION_PREVIEWS_ROW_ID}
        title="Conversation previews"
        description="Show conversation previews in history."
      >
        <Switch
          checked={preferences.showConversationPreviews}
          onCheckedChange={setShowConversationPreviews}
        />
      </SettingsRow>
      <SettingsRow
        id={MULTI_MODEL_ROW_ID}
        title="Multi-model chat"
        description="Send prompts to multiple models at once."
      >
        <Switch
          checked={preferences.multiModelEnabled}
          onCheckedChange={setMultiModelEnabled}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
