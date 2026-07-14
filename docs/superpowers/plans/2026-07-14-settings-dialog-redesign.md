# Settings Dialog Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Zola's settings dialog to match the reference layout (sidebar nav + search, titled sections with a label/control row pattern, segmented controls, new dark-surface design tokens) while keeping every existing setting's behavior unchanged.

**Architecture:** Add a small set of new presentation primitives (`SettingsSection`, `SettingsRow`, `SegmentedControl`, `SettingsSidebarNav`) plus new CSS design tokens, then migrate each existing settings tab's leaf components to use them. A static search index (`settings-search-index.ts`) drives the sidebar's search-and-jump behavior. The `Tabs`-based state model in `settings-content.tsx` is kept — only its visual composition changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (`app/globals.css`, no separate config file), shadcn/ui primitives (`components/ui/`), `@phosphor-icons/react` + `lucide-react` icons, `next-themes`.

## Global Constraints

- No test runner exists in this repo (per `CLAUDE.md`) — every task's verification step is `npm run type-check` / `npm run lint` on the changed files plus a manual dev-server visual check. Do not add Jest/Vitest.
- Formatting: Prettier, no semicolons, double quotes, `es5` trailing commas, import order auto-sorted by `@ianvs/prettier-plugin-sort-imports` — run `npx prettier --write <file>` after editing if unsure of ordering, don't hand-order imports.
- New CSS tokens are **additive** — do not rename or remove any existing shadcn token (`--background`, `--primary`, `--secondary`, `--muted`, `--border`, etc.); other parts of the app depend on them.
- **Token naming deviates from the literal reference markup in one place, deliberately:** the reference HTML uses classes `text-primary`, `text-secondary`, `text-muted` for body-text tones. Those class names are already claimed in this repo by the existing shadcn `--color-primary` / `--color-secondary` / `--color-muted` tokens (button/background tones, not text tones) — reusing them would silently break every existing `bg-primary`/`text-primary` usage elsewhere in the app. This plan instead introduces `--color-fg-primary`, `--color-fg-secondary`, `--color-fg-muted` (utility classes `text-fg-primary`, `text-fg-secondary`, `text-fg-muted`). All other reference token names (`surface-1`, `surface-2`, `alpha-1`, `alpha-2`, `fill-field`, `fill-ghost-hover`, `shadow-field-ring`) are unclaimed and used as-is.
- Existing tab content (`general`, `appearance`, `prompts`, `apikeys`, `models`, `connections`, `mcp`, `usage`, `budget`) keeps its current data/logic (hooks, mutations, providers) untouched — only JSX structure and class names change, except where a step explicitly says otherwise (e.g. removing dead `useState` in `theme-selection.tsx`).

---

### Task 1: Design tokens

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: Tailwind utility classes `bg-surface-1`, `bg-surface-2`, `border-alpha-1`, `border-alpha-2`, `divide-alpha-1`, `bg-fill-field`, `bg-fill-ghost-hover`, `bg-fill-accent`, `text-fg-primary`, `text-fg-secondary`, `text-fg-muted`, `shadow-field-ring`, `shadow-focus` — consumed by every later task.

- [ ] **Step 1: Add token definitions to `app/globals.css`**

Add to the `@theme inline { ... }` block (after the existing `--color-card: var(--card-foreground);` line, before `--radius-sm:`):

```css
  --color-surface-1: var(--surface-1);
  --color-surface-2: var(--surface-2);
  --color-alpha-1: var(--alpha-1);
  --color-alpha-2: var(--alpha-2);
  --color-fill-field: var(--fill-field);
  --color-fill-ghost-hover: var(--fill-ghost-hover);
  --color-fill-accent: var(--fill-accent);
  --color-fg-primary: var(--fg-primary);
  --color-fg-secondary: var(--fg-secondary);
  --color-fg-muted: var(--fg-muted);
  --shadow-field-ring: inset 0 0 0 1px var(--alpha-2);
  --shadow-focus: 0 0 0 2px var(--ring);
```

Add to the `:root { ... }` block (after `--sidebar-ring: oklch(0.705 0.015 286.067);`, before the closing `}`):

```css
  --surface-1: oklch(97% 0 0);
  --surface-2: oklch(100% 0 0);
  --alpha-1: oklch(0% 0 0 / 6%);
  --alpha-2: oklch(0% 0 0 / 8%);
  --fill-field: oklch(0% 0 0 / 4%);
  --fill-ghost-hover: oklch(0% 0 0 / 5%);
  --fill-accent: var(--primary);
  --fg-primary: oklch(0.141 0.005 285.823);
  --fg-secondary: oklch(0.35 0.006 285.885);
  --fg-muted: oklch(0.552 0.016 285.938);
```

Add to the `.dark { ... }` block (after `--sidebar-ring: oklch(0.705 0.015 286.067);`, before the closing `}`):

```css
  --surface-1: oklch(15% 0 0);
  --surface-2: oklch(19% 0 0);
  --alpha-1: oklch(100% 0 0 / 6%);
  --alpha-2: oklch(100% 0 0 / 10%);
  --fill-field: oklch(100% 0 0 / 8%);
  --fill-ghost-hover: oklch(100% 0 0 / 6%);
  --fill-accent: var(--primary);
  --fg-primary: oklch(0.985 0 0);
  --fg-secondary: oklch(0.78 0 0);
  --fg-muted: oklch(0.6 0 0);
```

- [ ] **Step 2: Verify build picks up the new tokens**

Run: `npm run type-check`
Expected: no errors (this step is CSS-only, but confirms nothing else broke).

Run: `npm run dev` in one terminal, then in the browser open dev tools on any page and run in the console:
```js
getComputedStyle(document.documentElement).getPropertyValue('--surface-1')
```
Expected: a non-empty oklch string, and it changes value when toggling the `.dark` class on `<html>` (via the app's theme toggle).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(settings): add surface/alpha/fill design tokens"
```

---

### Task 2: SegmentedControl primitive

**Files:**
- Create: `components/ui/segmented-control.tsx`

**Interfaces:**
- Produces: `SegmentedControl<T extends string>` component — `{ value: T, onValueChange: (value: T) => void, options: { value: T, label: string, icon?: React.ReactNode }[], "aria-label": string }`. Consumed by Task 6 (`theme-selection.tsx`).

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { cn } from "@/lib/utils"

type SegmentedControlOption<T extends string> = {
  value: T
  label: string
  icon?: React.ReactNode
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  "aria-label": string
  className?: string
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest["aria-label"]}
      className={cn(
        "bg-alpha-1 inline-flex h-9 items-stretch gap-0.5 rounded-md p-[2px]",
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={option.icon ? option.label : undefined}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-[calc(var(--radius-md)-2px)] text-sm transition-colors",
              option.icon ? "aspect-square" : "px-3",
              isActive
                ? "bg-surface-2 text-fg-primary shadow-sm"
                : "text-fg-muted hover:text-fg-primary"
            )}
          >
            {option.icon ?? option.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/segmented-control.tsx
git commit -m "feat(settings): add SegmentedControl primitive"
```

---

### Task 3: SettingsSection + SettingsRow primitives

**Files:**
- Create: `app/components/layout/settings/settings-section.tsx`
- Create: `app/components/layout/settings/settings-row.tsx`

**Interfaces:**
- Produces: `SettingsSection` — `{ id?: string, title: string, children: React.ReactNode, className?: string }`.
- Produces: `SettingsRow` — `{ id?: string, title: string, description?: React.ReactNode, align?: "center" | "start", children: React.ReactNode, className?: string }`. Default `align` is `"center"` (label left, control right). `align="start"` stacks label/description above `children` full-width (for the system-prompt textarea).
- Consumed by Tasks 4, 5, 6, 9.

- [ ] **Step 1: Create `SettingsSection`**

```tsx
import { cn } from "@/lib/utils"

type SettingsSectionProps = {
  id?: string
  title: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({
  id,
  title,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section id={id} className={cn("mb-8 last:mb-0", className)}>
      <h3 className="text-fg-primary mb-4 text-base font-semibold">{title}</h3>
      <div className="divide-alpha-1 divide-y">{children}</div>
    </section>
  )
}
```

- [ ] **Step 2: Create `SettingsRow`**

```tsx
import { cn } from "@/lib/utils"

type SettingsRowProps = {
  id?: string
  title: string
  description?: React.ReactNode
  align?: "center" | "start"
  children: React.ReactNode
  className?: string
}

export function SettingsRow({
  id,
  title,
  description,
  align = "center",
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex gap-6 py-4",
        align === "center" ? "items-center justify-between" : "flex-col",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
        <div className="text-fg-primary text-sm">{title}</div>
        {description && (
          <div className="text-fg-muted text-sm">{description}</div>
        )}
      </div>
      {align === "center" ? (
        <div className="flex shrink-0 items-center">{children}</div>
      ) : (
        children
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify types**

Run: `npm run type-check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/components/layout/settings/settings-section.tsx app/components/layout/settings/settings-row.tsx
git commit -m "feat(settings): add SettingsSection and SettingsRow primitives"
```

---

### Task 4: General tab leaf rewrites

**Files:**
- Modify: `app/components/layout/settings/general/user-profile.tsx`
- Modify: `app/components/layout/settings/general/account-management.tsx`
- Modify: `app/components/layout/settings/general/history-management.tsx`

**Interfaces:**
- Consumes: `SettingsSection`, `SettingsRow` (Task 3).
- Produces: `USER_PROFILE_ROW_ID = "settings-row-general-profile"`, `ACCOUNT_MANAGEMENT_ROW_ID = "settings-row-general-account"`, `HISTORY_MANAGEMENT_ROW_ID = "settings-row-general-history"` — consumed by Task 7 (`settings-search-index.ts`).

- [ ] **Step 1: Rewrite `user-profile.tsx`**

```tsx
"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useUser } from "@/lib/user-store/provider"
import { User } from "@phosphor-icons/react"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const USER_PROFILE_ROW_ID = "settings-row-general-profile"

export function UserProfile() {
  const { user } = useUser()

  if (!user) return null

  return (
    <SettingsSection title="Profile">
      <SettingsRow id={USER_PROFILE_ROW_ID} title="Avatar">
        <div className="bg-fill-field flex size-10 items-center justify-center overflow-hidden rounded-full">
          {user?.profile_image ? (
            <Avatar className="size-10 rounded-full">
              <AvatarImage
                src={user.profile_image || undefined}
                className="object-cover"
              />
              <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <User className="text-fg-muted size-6" />
          )}
        </div>
      </SettingsRow>
      <SettingsRow title="Full name">
        <span className="text-fg-primary text-sm">{user?.display_name}</span>
      </SettingsRow>
      <SettingsRow title="Email">
        <span className="text-fg-muted text-sm">{user?.email}</span>
      </SettingsRow>
    </SettingsSection>
  )
}
```

- [ ] **Step 2: Rewrite `account-management.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { useMessages } from "@/lib/chat-store/messages/provider"
import { clearAllIndexedDBStores } from "@/lib/chat-store/persist"
import { useUser } from "@/lib/user-store/provider"
import { SignOut } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const ACCOUNT_MANAGEMENT_ROW_ID = "settings-row-general-account"

export function AccountManagement() {
  const { signOut } = useUser()
  const { resetChats } = useChats()
  const { resetMessages } = useMessages()
  const router = useRouter()

  const handleSignOut = async () => {
    try {
      await resetMessages()
      await resetChats()
      await signOut()
      await clearAllIndexedDBStores()
      router.push("/")
    } catch (e) {
      console.error("Sign out failed:", e)
      toast({ title: "Failed to sign out", status: "error" })
    }
  }

  return (
    <SettingsSection title="Account">
      <SettingsRow
        id={ACCOUNT_MANAGEMENT_ROW_ID}
        title="Log out"
        description="Sign out on this device."
      >
        <Button
          variant="default"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleSignOut}
        >
          <SignOut className="size-4" />
          <span>Sign out</span>
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
```

- [ ] **Step 3: Rewrite `history-management.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toast"
import { useChats } from "@/lib/chat-store/chats/provider"
import { clearMessagesForChat } from "@/lib/chat-store/messages/api"
import { useChatSession } from "@/lib/chat-store/session/provider"
import { TrashSimple } from "@phosphor-icons/react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const HISTORY_MANAGEMENT_ROW_ID = "settings-row-general-history"

export function HistoryManagement() {
  const { chats, deleteChat } = useChats()
  const { chatId } = useChatSession()
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAll = useCallback(async () => {
    if (isDeleting) return

    const confirm = window.confirm(
      "Delete all chat history? This removes all non-pinned conversations."
    )
    if (!confirm) return

    try {
      setIsDeleting(true)
      const deletable = chats.filter((c) => !c.pinned && !c.project_id)

      for (const chat of deletable) {
        try {
          await clearMessagesForChat(chat.id)
        } catch (e) {
          console.error("Failed clearing messages for", chat.id, e)
        }
        try {
          await deleteChat(chat.id, chatId || undefined, () => router.push("/"))
        } catch (e) {
          console.error("Failed deleting chat", chat.id, e)
        }
      }

      toast({ title: "History cleared" })
    } catch (e) {
      console.error(e)
      toast({ title: "Failed to clear history", status: "error" })
    } finally {
      setIsDeleting(false)
    }
  }, [isDeleting, chats, deleteChat, chatId, router])

  return (
    <SettingsSection title="History">
      <SettingsRow
        id={HISTORY_MANAGEMENT_ROW_ID}
        title="Clear history"
        description="Remove all non-pinned conversations from your history."
      >
        <Button
          variant="destructive"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleDeleteAll}
          disabled={isDeleting}
        >
          <TrashSimple className="size-4" />
          <span>{isDeleting ? "Deleting..." : "Delete All"}</span>
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors in the three modified files.

- [ ] **Step 5: Commit**

```bash
git add app/components/layout/settings/general/user-profile.tsx app/components/layout/settings/general/account-management.tsx app/components/layout/settings/general/history-management.tsx
git commit -m "refactor(settings): migrate General tab to SettingsSection/Row"
```

---

### Task 5: Prompts tab leaf rewrite

**Files:**
- Modify: `app/components/layout/settings/general/system-prompt.tsx`

**Interfaces:**
- Consumes: `SettingsSection`, `SettingsRow` (Task 3).
- Produces: `SYSTEM_PROMPT_ROW_ID = "settings-row-prompts-system-prompt"` — consumed by Task 7.

- [ ] **Step 1: Rewrite `system-prompt.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useUser } from "@/lib/user-store/provider"
import { AnimatePresence, motion } from "motion/react"
import { useState } from "react"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const SYSTEM_PROMPT_ROW_ID = "settings-row-prompts-system-prompt"

export function SystemPromptSection() {
  const { user, updateUser } = useUser()
  const [isLoading, setIsLoading] = useState(false)
  const [prompt, setPrompt] = useState<string | null>(null)
  const effectivePrompt = prompt ?? user?.system_prompt ?? ""

  const savePrompt = async () => {
    if (!user?.id) return

    setIsLoading(true)
    try {
      await updateUser({ system_prompt: prompt })

      toast({
        title: "Prompt saved",
        description: "It'll be used for new chats.",
        status: "success",
      })
    } catch (error) {
      console.error("Error saving system prompt:", error)
      toast({
        title: "Failed to save",
        description: "Couldn't save your system prompt. Please try again.",
        status: "error",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setPrompt(value)
  }

  const hasChanges = effectivePrompt !== (user?.system_prompt || "")

  return (
    <SettingsSection title="Prompts">
      <SettingsRow
        id={SYSTEM_PROMPT_ROW_ID}
        align="start"
        title="Default system prompt"
        description="This prompt will be used for new chats."
      >
        <div className="relative">
          <Textarea
            id="system-prompt"
            className="min-h-24 w-full"
            placeholder="Enter a default system prompt for new conversations"
            value={effectivePrompt}
            onChange={handlePromptChange}
          />

          <AnimatePresence>
            {hasChanges && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute right-3 bottom-3"
              >
                <Button
                  size="sm"
                  onClick={savePrompt}
                  className="shadow-sm"
                  disabled={isLoading}
                >
                  {isLoading ? "Saving..." : "Save prompt"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </SettingsRow>
    </SettingsSection>
  )
}
```

Note: the `<Label htmlFor="system-prompt">` from the original was dropped in favor of `SettingsRow`'s `title`, which is no longer a `<label>` element. This is an acceptable a11y trade-off consistent with every other row in this redesign (none of them use `<label htmlFor>` association) — flagged here, not hidden.

- [ ] **Step 2: Verify types and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/layout/settings/general/system-prompt.tsx
git commit -m "refactor(settings): migrate Prompts tab to SettingsSection/Row"
```

---

### Task 6: Appearance tab leaf rewrites

**Files:**
- Modify: `app/components/layout/settings/appearance/theme-selection.tsx`
- Modify: `app/components/layout/settings/appearance/layout-settings.tsx`
- Modify: `app/components/layout/settings/appearance/interaction-preferences.tsx`

**Interfaces:**
- Consumes: `SettingsSection`, `SettingsRow` (Task 3), `SegmentedControl` (Task 2).
- Produces: `THEME_SELECTION_ROW_ID`, `LAYOUT_SETTINGS_ROW_ID`, `PROMPT_SUGGESTIONS_ROW_ID`, `TOOL_INVOCATIONS_ROW_ID`, `CONVERSATION_PREVIEWS_ROW_ID`, `MULTI_MODEL_ROW_ID` — consumed by Task 7.

- [ ] **Step 1: Rewrite `theme-selection.tsx`**

The original kept a redundant local `selectedTheme` state that duplicated `next-themes`'s own `theme` value — dropped here since `SegmentedControl` can read `theme` directly.

```tsx
"use client"

import { SegmentedControl } from "@/components/ui/segmented-control"
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react"
import { useTheme } from "next-themes"
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"

export const THEME_SELECTION_ROW_ID = "settings-row-appearance-theme"

type ThemeValue = "system" | "light" | "dark"

export function ThemeSelection() {
  const { theme, setTheme } = useTheme()

  return (
    <SettingsSection title="Theme">
      <SettingsRow id={THEME_SELECTION_ROW_ID} title="Appearance">
        <SegmentedControl<ThemeValue>
          aria-label="Appearance"
          value={(theme as ThemeValue) || "system"}
          onValueChange={setTheme}
          options={[
            { value: "system", label: "System", icon: <DesktopIcon className="size-4" /> },
            { value: "light", label: "Light", icon: <SunIcon className="size-4" /> },
            { value: "dark", label: "Dark", icon: <MoonIcon className="size-4" /> },
          ]}
        />
      </SettingsRow>
    </SettingsSection>
  )
}
```

- [ ] **Step 2: Rewrite `layout-settings.tsx`**

Only the final `export function LayoutSettings()` changes — the `LayoutSidebar`/`LayoutFullscreen` SVG components above it (lines 1–237 of the original) are untouched, keep them exactly as-is in the file.

Replace the existing `export function LayoutSettings() { ... }` block (originally lines 239–278) with:

```tsx
export const LAYOUT_SETTINGS_ROW_ID = "settings-row-appearance-layout"

export function LayoutSettings() {
  const { preferences, setLayout } = useUserPreferences()

  const handleLayoutChange = (layout: LayoutType) => {
    setLayout(layout)
  }

  return (
    <SettingsSection title="Layout">
      <SettingsRow
        id={LAYOUT_SETTINGS_ROW_ID}
        align="start"
        title="Sidebar layout"
        description="Choose how the app sidebar is displayed."
      >
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => handleLayoutChange("sidebar")}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              preferences.layout === "sidebar"
                ? "border-primary ring-primary/30 ring-2"
                : "border-alpha-1 hover:bg-fill-ghost-hover"
            )}
          >
            <LayoutSidebar className="h-full w-full" />
          </button>

          <button
            type="button"
            onClick={() => handleLayoutChange("fullscreen")}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              preferences.layout === "fullscreen"
                ? "border-primary ring-primary/30 ring-2"
                : "border-alpha-1 hover:bg-fill-ghost-hover"
            )}
          >
            <LayoutFullscreen className="h-full w-full" />
          </button>
        </div>
      </SettingsRow>
    </SettingsSection>
  )
}
```

Also add these two imports to the top of the file, alongside the existing `LayoutType`/`useUserPreferences`/`cn`/`React` imports:

```tsx
import { SettingsRow } from "../settings-row"
import { SettingsSection } from "../settings-section"
```

- [ ] **Step 3: Rewrite `interaction-preferences.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify types and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors in the three modified files.

- [ ] **Step 5: Commit**

```bash
git add app/components/layout/settings/appearance/theme-selection.tsx app/components/layout/settings/appearance/layout-settings.tsx app/components/layout/settings/appearance/interaction-preferences.tsx
git commit -m "refactor(settings): migrate Appearance tab to SettingsSection/Row + SegmentedControl"
```

---

### Task 7: Search index

**Files:**
- Create: `app/components/layout/settings/settings-search-index.ts`

**Interfaces:**
- Consumes: row-id constants from Tasks 4–6 (`USER_PROFILE_ROW_ID`, `ACCOUNT_MANAGEMENT_ROW_ID`, `HISTORY_MANAGEMENT_ROW_ID`, `SYSTEM_PROMPT_ROW_ID`, `THEME_SELECTION_ROW_ID`, `LAYOUT_SETTINGS_ROW_ID`, `PROMPT_SUGGESTIONS_ROW_ID`, `TOOL_INVOCATIONS_ROW_ID`, `CONVERSATION_PREVIEWS_ROW_ID`, `MULTI_MODEL_ROW_ID`).
- Produces: `TabType` (moved here as the single source of truth — re-exported from `settings-content.tsx` in Task 9 to avoid a duplicate definition), `SettingsSearchEntry` type, `SETTINGS_SEARCH_INDEX` array, `SECTION_IDS` object (coarse ids for the list-heavy tabs), `searchSettingsIndex(query, supabaseEnabled)` function. Consumed by Task 8 (`settings-sidebar-nav.tsx`) and Task 9 (`settings-content.tsx`).

- [ ] **Step 1: Create the file**

```ts
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
  supabaseOnly?: boolean
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
  { tab: "usage", rowId: SECTION_IDS.usage, label: "Usage & Cost", supabaseOnly: true },
  { tab: "budget", rowId: SECTION_IDS.budget, label: "Budget", supabaseOnly: true },
]

export function searchSettingsIndex(
  query: string,
  supabaseEnabled: boolean
): SettingsSearchEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return SETTINGS_SEARCH_INDEX.filter((entry) => {
    if (entry.supabaseOnly && !supabaseEnabled) return false
    const haystack = `${entry.label} ${entry.description ?? ""} ${entry.tab}`.toLowerCase()
    return haystack.includes(q)
  })
}
```

- [ ] **Step 2: Verify types**

Run: `npm run type-check`
Expected: no errors — this also confirms every imported row-id constant from Tasks 4–6 actually exists and is exported with the right name.

- [ ] **Step 3: Commit**

```bash
git add app/components/layout/settings/settings-search-index.ts
git commit -m "feat(settings): add static search index for settings rows"
```

---

### Task 8: SettingsSidebarNav component

**Files:**
- Create: `app/components/layout/settings/settings-sidebar-nav.tsx`

**Interfaces:**
- Consumes: `TabType`, `searchSettingsIndex`, `SettingsSearchEntry` (Task 7).
- Produces: `SettingsSidebarNav` component — `{ activeTab: TabType, onTabChange: (tab: TabType) => void, searchQuery: string, onSearchQueryChange: (query: string) => void, onResultSelect: (entry: SettingsSearchEntry) => void, supabaseEnabled: boolean }`. Consumed by Task 9 (`settings-content.tsx`).

- [ ] **Step 1: Create the component**

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  CubeIcon,
  GearSixIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  NotePencilIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
} from "@phosphor-icons/react"
import { DollarSign, Server, Database } from "lucide-react"
import {
  searchSettingsIndex,
  type SettingsSearchEntry,
  type TabType,
} from "./settings-search-index"

type NavItem = {
  tab: TabType
  label: string
  icon: React.ReactNode
  supabaseOnly?: boolean
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Settings",
    items: [
      { tab: "general", label: "General", icon: <GearSixIcon className="size-4" /> },
      { tab: "appearance", label: "Appearance", icon: <PaintBrushIcon className="size-4" /> },
      { tab: "prompts", label: "Prompts", icon: <NotePencilIcon className="size-4" /> },
      { tab: "apikeys", label: "API Keys", icon: <KeyIcon className="size-4" /> },
      { tab: "models", label: "Models", icon: <CubeIcon className="size-4" /> },
      { tab: "usage", label: "Usage & Cost", icon: <Database className="size-4" />, supabaseOnly: true },
      { tab: "budget", label: "Budget", icon: <DollarSign className="size-4" />, supabaseOnly: true },
    ],
  },
  {
    label: "Customize",
    items: [
      { tab: "connections", label: "Connections", icon: <PlugsConnectedIcon className="size-4" /> },
      { tab: "mcp", label: "MCP Servers", icon: <Server className="size-4" /> },
    ],
  },
]

type SettingsSidebarNavProps = {
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  searchQuery: string
  onSearchQueryChange: (query: string) => void
  onResultSelect: (entry: SettingsSearchEntry) => void
  supabaseEnabled: boolean
}

export function SettingsSidebarNav({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchQueryChange,
  onResultSelect,
  supabaseEnabled,
}: SettingsSidebarNavProps) {
  const searchResults = searchSettingsIndex(searchQuery, supabaseEnabled)
  const isSearching = searchQuery.trim().length > 0

  return (
    <nav
      aria-label="Settings"
      className="border-alpha-1 bg-surface-1 flex w-48 shrink-0 flex-col gap-2 border-r"
    >
      <h2 className="sr-only">Settings</h2>
      <div className="shrink-0 px-3 pt-3">
        <div className="bg-fill-field flex h-9 w-full items-center gap-2 rounded px-2">
          <MagnifyingGlassIcon className="text-fg-muted size-4 shrink-0" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Search"
            aria-label="Search settings"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {isSearching ? (
          searchResults.length > 0 ? (
            <ul className="flex flex-col gap-px">
              {searchResults.map((entry) => (
                <li key={entry.rowId}>
                  <button
                    type="button"
                    onClick={() => onResultSelect(entry)}
                    className="hover:bg-fill-ghost-hover flex w-full flex-col items-start gap-0.5 rounded px-2 py-1.5 text-left"
                  >
                    <span className="text-fg-primary text-sm">{entry.label}</span>
                    <span className="text-fg-muted text-xs">
                      in {NAV_GROUPS.flatMap((g) => g.items).find((i) => i.tab === entry.tab)?.label ?? entry.tab}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-fg-muted px-2 py-1.5 text-sm">No matching settings</p>
          )
        ) : (
          NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.supabaseOnly || supabaseEnabled)
            if (items.length === 0) return null
            return (
              <div key={group.label}>
                <div className="text-fg-muted px-2 pb-1 text-xs">{group.label}</div>
                <ul className="flex flex-col gap-px">
                  {items.map((item) => {
                    const isActive = item.tab === activeTab
                    return (
                      <li key={item.tab}>
                        <button
                          type="button"
                          onClick={() => onTabChange(item.tab)}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm transition-colors",
                            isActive
                              ? "bg-alpha-2 text-fg-primary font-medium"
                              : "text-fg-secondary hover:bg-fill-ghost-hover hover:text-fg-primary"
                          )}
                        >
                          <span className="text-fg-secondary shrink-0">{item.icon}</span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })
        )}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Verify types and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/layout/settings/settings-sidebar-nav.tsx
git commit -m "feat(settings): add SettingsSidebarNav with search-and-jump"
```

---

### Task 9: Rewire settings-content.tsx and settings-trigger.tsx

**Files:**
- Modify: `app/components/layout/settings/settings-content.tsx`
- Modify: `app/components/layout/settings/settings-trigger.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `SettingsSidebarNav` (Task 8), `SettingsSection`/`SettingsRow` (Task 3), `TabType`/`SECTION_IDS`/`SettingsSearchEntry` (Task 7).
- Produces: `TabType` re-exported from `settings-content.tsx` (existing external consumers of this type, e.g. `budget-settings.tsx`'s `openSettings` event dispatch, keep working unmodified).

- [ ] **Step 1: Add the row-highlight animation to `app/globals.css`**

Add after the existing `.themed-icon * { ... }` block:

```css
/* Settings search result jump highlight */
.settings-row-highlight {
  animation: settings-row-flash 1.2s ease-out;
}

@keyframes settings-row-flash {
  0% {
    background-color: var(--alpha-2);
  }
  100% {
    background-color: transparent;
  }
}
```

- [ ] **Step 2: Rewrite `settings-content.tsx`**

```tsx
"use client"

import { Button } from "@/components/ui/button"
import { DrawerClose } from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { isSupabaseEnabled } from "@/lib/supabase/config"
import { cn, isDev } from "@/lib/utils"
import {
  CubeIcon,
  GearSixIcon,
  KeyIcon,
  NotePencilIcon,
  PaintBrushIcon,
  PlugsConnectedIcon,
  XIcon,
} from "@phosphor-icons/react"
import { Server, Database, DollarSign } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ByokSection } from "./apikeys/byok-section"
import { InteractionPreferences } from "./appearance/interaction-preferences"
import { LayoutSettings } from "./appearance/layout-settings"
import { ThemeSelection } from "./appearance/theme-selection"
import { ConnectionsPlaceholder } from "./connections/connections-placeholder"
import { DeveloperTools } from "./connections/developer-tools"
import { OllamaSection } from "./connections/ollama-section"
import { AccountManagement } from "./general/account-management"
import { HistoryManagement } from "./general/history-management"
import { SystemPromptSection } from "./general/system-prompt"
import { UserProfile } from "./general/user-profile"
import { ModelsSettings } from "./models/models-settings"
import { MCPSettings } from "./mcp/mcp-settings"
import { UsageSettings } from "./usage/usage-settings"
import { BudgetSettings } from "./budget/budget-settings"
import { SettingsSection } from "./settings-section"
import { SettingsSidebarNav } from "./settings-sidebar-nav"
import {
  SECTION_IDS,
  type SettingsSearchEntry,
  type TabType,
} from "./settings-search-index"

export type { TabType }

type SettingsContentProps = {
  isDrawer?: boolean
  activeTab?: TabType
}

const MOBILE_TABS: { tab: TabType; label: string; icon: React.ReactNode }[] = [
  { tab: "general", label: "General", icon: <GearSixIcon className="size-4" /> },
  { tab: "appearance", label: "Appearance", icon: <PaintBrushIcon className="size-4" /> },
  { tab: "prompts", label: "Prompts", icon: <NotePencilIcon className="size-4" /> },
  { tab: "apikeys", label: "API Keys", icon: <KeyIcon className="size-4" /> },
  { tab: "models", label: "Models", icon: <CubeIcon className="size-4" /> },
  { tab: "connections", label: "Connections", icon: <PlugsConnectedIcon className="size-4" /> },
  { tab: "mcp", label: "MCP Servers", icon: <Server className="size-4" /> },
  { tab: "usage", label: "Usage & Cost", icon: <Database className="size-4" /> },
  { tab: "budget", label: "Budget", icon: <DollarSign className="size-4" /> },
]

function TabContent({ activeTab }: { activeTab: TabType }) {
  switch (activeTab) {
    case "general":
      return (
        <>
          <UserProfile />
          {isSupabaseEnabled && (
            <>
              <AccountManagement />
              <HistoryManagement />
            </>
          )}
        </>
      )
    case "appearance":
      return (
        <>
          <ThemeSelection />
          <LayoutSettings />
          <InteractionPreferences />
        </>
      )
    case "prompts":
      return <SystemPromptSection />
    case "apikeys":
      return (
        <SettingsSection id={SECTION_IDS.apikeys} title="API Keys">
          <ByokSection />
        </SettingsSection>
      )
    case "models":
      return (
        <SettingsSection id={SECTION_IDS.models} title="Models">
          <ModelsSettings />
        </SettingsSection>
      )
    case "connections":
      return (
        <SettingsSection id={SECTION_IDS.connections} title="Connections">
          {!isDev && <ConnectionsPlaceholder />}
          {isDev && <OllamaSection />}
          {isDev && <DeveloperTools />}
        </SettingsSection>
      )
    case "mcp":
      return (
        <SettingsSection id={SECTION_IDS.mcp} title="MCP Servers">
          <MCPSettings />
        </SettingsSection>
      )
    case "usage":
      return isSupabaseEnabled ? (
        <SettingsSection id={SECTION_IDS.usage} title="Usage & Cost">
          <UsageSettings />
        </SettingsSection>
      ) : null
    case "budget":
      return isSupabaseEnabled ? (
        <SettingsSection id={SECTION_IDS.budget} title="Budget">
          <BudgetSettings />
        </SettingsSection>
      ) : null
    default:
      return null
  }
}

export function SettingsContent({
  isDrawer = false,
  activeTab: initialActiveTab = "general",
}: SettingsContentProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialActiveTab)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    setActiveTab(initialActiveTab)
  }, [initialActiveTab])

  const handleResultSelect = useCallback((entry: SettingsSearchEntry) => {
    setActiveTab(entry.tab)
    setSearchQuery("")
    requestAnimationFrame(() => {
      const el = document.getElementById(entry.rowId)
      if (!el) return
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      el.classList.add("settings-row-highlight")
      window.setTimeout(() => el.classList.remove("settings-row-highlight"), 1200)
    })
  }, [])

  if (isDrawer) {
    return (
      <div className="bg-surface-2 flex w-full flex-col pb-16">
        <div className="border-alpha-1 flex items-center justify-between border-b px-4 pb-2">
          <h2 className="text-fg-primary text-lg font-medium">Settings</h2>
          <DrawerClose asChild>
            <Button variant="ghost" size="icon">
              <XIcon className="size-4" />
            </Button>
          </DrawerClose>
        </div>

        <div className="bg-fill-field mx-4 mt-3 flex h-9 items-center gap-2 rounded px-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none focus-visible:ring-0"
          />
        </div>

        <div className="my-3 flex w-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto px-4">
          {MOBILE_TABS.filter(
            (t) => !["usage", "budget"].includes(t.tab) || isSupabaseEnabled
          ).map((t) => (
            <button
              key={t.tab}
              type="button"
              onClick={() => setActiveTab(t.tab)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded px-3 py-1.5 text-sm",
                t.tab === activeTab
                  ? "bg-alpha-2 text-fg-primary font-medium"
                  : "text-fg-secondary"
              )}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="px-6">
          <TabContent activeTab={activeTab} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-2 flex min-h-0 w-full flex-1 flex-row">
      <SettingsSidebarNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onResultSelect={handleResultSelect}
        supabaseEnabled={isSupabaseEnabled}
      />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-8 py-6">
        <TabContent activeTab={activeTab} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Update `settings-trigger.tsx`**

Replace the `TabType` local definition and the `DialogContent`/`DialogHeader` markup:

```tsx
"use client"

import { useBreakpoint } from "@/app/hooks/use-breakpoint"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerTrigger } from "@/components/ui/drawer"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { User } from "@phosphor-icons/react"
import type React from "react"
import { useEffect, useState } from "react"
import { SettingsContent, type TabType } from "./settings-content"

type SettingsTriggerProps = {
  onOpenChange: (open: boolean) => void
}

export function SettingsTrigger({ onOpenChange }: SettingsTriggerProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>("general")
  const isMobile = useBreakpoint(768)

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen)
    onOpenChange(isOpen)
  }

  useEffect(() => {
    const handleOpenSettings = (event: Event) => {
      const customEvent = event as CustomEvent<{ tab?: TabType }>
      if (customEvent.detail?.tab) {
        setActiveTab(customEvent.detail.tab)
      }
      setOpen(true)
    }

    window.addEventListener('openSettings', handleOpenSettings)
    return () => {
      window.removeEventListener('openSettings', handleOpenSettings)
    }
  }, [])

  const trigger = (
    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
      <User className="size-4" />
      <span>Settings</span>
    </DropdownMenuItem>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent>
          <SettingsContent isDrawer activeTab={activeTab} />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="border-alpha-1 flex h-[80%] min-h-[480px] w-full flex-row gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[860px]">
        <DialogTitle className="sr-only">Settings</DialogTitle>
        <DialogDescription className="sr-only">
          Manage your account, appearance, and connection settings.
        </DialogDescription>
        <SettingsContent activeTab={activeTab} />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Verify types and lint**

Run: `npm run type-check && npm run lint`
Expected: no errors. Pay particular attention to any other file importing `TabType` from `settings-content.tsx` (e.g. `budget-settings.tsx`'s `openSettings` dispatch) — it must still resolve since `TabType` is re-exported from `settings-content.tsx`.

Run: `grep -rn "from \"@/app/components/layout/settings/settings-content\"" app/ --include=*.tsx` and confirm every match still type-checks after this change (no other file destructures the removed `TabsContent`/`TabsList` exports, since those were never exported).

- [ ] **Step 5: Manual visual check**

Run: `npm run dev`, open the app, sign in (or guest mode), open Settings from the user menu.
Checklist:
- Sidebar shows two groups ("Settings", "Customize") with the right items, active item highlighted.
- Typing in the search box filters to a flat result list; clicking a result switches tab and scrolls to + briefly highlights the matching row.
- Every tab renders without console errors: General, Appearance, Prompts, API Keys, Models, Connections, MCP Servers, and (if Supabase is configured) Usage & Cost, Budget.
- Resize the window below 768px (or use device toolbar) and confirm the mobile drawer still opens, shows the horizontal tab scroller and search box, and all tabs render.
- Toggle light/dark theme and confirm the new tokens (surfaces, borders, hover states) look correct in both.

- [ ] **Step 6: Commit**

```bash
git add app/components/layout/settings/settings-content.tsx app/components/layout/settings/settings-trigger.tsx app/globals.css
git commit -m "refactor(settings): compose SettingsSidebarNav into settings dialog"
```

---

### Task 10: Final verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: zero errors across the whole repo (not just changed files — confirms no downstream breakage, e.g. anything else importing the old `Tabs`-based exports from `settings-content.tsx`).

- [ ] **Step 2: Production build**

Run: `npm run build`
Expected: build succeeds (this repo builds with webpack, not Turbopack — per `CLAUDE.md`).

- [ ] **Step 3: Re-run the manual visual checklist from Task 9 Step 5 against the reference screenshot**

Compare side-by-side: sidebar width/spacing, section title weight/size, row label/description sizing, segmented control look for Appearance, divider colors between rows, hover/active states. Note any visible deltas and decide inline whether they're worth a follow-up polish pass or acceptable — this plan does not require literal pixel-matching beyond what's specified in the design tokens (Task 1).

- [ ] **Step 4: Commit** (only if Step 3 produced follow-up fixes; otherwise nothing to commit)
