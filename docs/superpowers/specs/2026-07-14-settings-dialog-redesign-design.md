# Settings Dialog Redesign

## Goal

Redesign Zola's settings dialog to visually match a reference layout (Claude
web app's settings dialog): a left sidebar with search + grouped nav, and a
right content pane organized into titled sections with a consistent
label/control row pattern. Same visual system (dark surfaces, hairline
dividers, segmented controls, switches), applied to Zola's actual settings
content — not a literal copy of Claude's nav items.

## Current state

`app/components/layout/settings/settings-content.tsx` renders a shadcn `Tabs`
tree: `TabsList` as a plain 48-width vertical list of `TabsTrigger`s (desktop)
or a horizontal scroller (mobile drawer), `TabsContent` panels stacked with
`space-y-6`. Nine tabs: `general`, `appearance`, `prompts`, `apikeys`,
`models`, `connections`, `mcp`, `usage` (Supabase-gated), `budget`
(Supabase-gated). Each tab's content lives in its own component file (e.g.
`appearance/theme-selection.tsx`) and hand-rolls its own layout — cards, grids,
ad hoc spacing — with no shared row/section primitive. `components/ui/toggle-group.tsx`
exists but is unused; there's no segmented-control pattern in use today.
Design tokens referenced by the target layout (`surface-1`, `surface-2`,
`alpha-1`, `alpha-2`, `fill-field`, `fill-ghost-hover`, `shadow-field-ring`, a
`text-primary`/`text-secondary`/`text-muted` scale) don't exist in
`app/globals.css` — only standard shadcn tokens (`background`, `card`,
`muted`, `border`, etc.) are defined there today.

## Scope

- New Tailwind/CSS tokens in `app/globals.css` (light + dark) matching the
  reference: `surface-1`, `surface-2`, `alpha-1`, `alpha-2`, `fill-field`,
  `fill-ghost-hover`, `fill-accent`, `shadow-field-ring`, `shadow-focus`, plus
  a `text-primary`/`text-secondary`/`text-muted` tone scale. Additive only —
  existing shadcn tokens stay for the rest of the app.
- New shared components under `app/components/layout/settings/`:
  - `settings-sidebar-nav.tsx` — search input + two nav groups ("Settings":
    General, Appearance, API Keys, Models, Usage & Cost, Budget; "Customize":
    Connections, MCP Servers). Active item styling, hover states, icons
    (reuse existing icon set from `settings-content.tsx`).
  - `settings-section.tsx` — `<section>` wrapper: title + `divide-y
    divide-alpha-1` row container.
  - `settings-row.tsx` — generic row: label (+ optional description) left,
    control slot right. Accepts an `id` prop for search-jump targeting.
  - `segmented-control.tsx` (in `components/ui/` or
    `components/common/`, matching existing conventions) — replaces the
    hand-rolled theme-picker button grid; used for Appearance (System/Light/
    Dark) and Motion (System/Reduced).
  - `settings-search-index.ts` — flat static array of
    `{ tab: TabType, rowId: string, label: string, description?: string }`,
    one entry per searchable row across all tabs, hand-maintained alongside
    the row components.
- Rewrite the *presentation* layer of existing section components (
  `general/user-profile.tsx`, `general/account-management.tsx`,
  `general/history-management.tsx`, `general/system-prompt.tsx`,
  `appearance/theme-selection.tsx`, `appearance/layout-settings.tsx`,
  `appearance/interaction-preferences.tsx`, `usage/usage-settings.tsx`,
  `budget/budget-settings.tsx`) to use `SettingsSection`/`SettingsRow`/
  `SegmentedControl` instead of their current custom markup. Existing logic
  (data fetching, mutations, `useTheme`, form state) is untouched — only JSX
  structure and classNames change.
- List-heavy sections (`apikeys/byok-section.tsx`, `models/models-settings.tsx`,
  `connections/*`, `mcp/mcp-settings.tsx`) keep their existing internal list/
  table UI, just wrapped in a `SettingsSection` for consistent title/spacing —
  their internals are not forced into the row pattern.
- `settings-content.tsx` rewritten to compose `SettingsSidebarNav` +
  content pane, keeping the existing `activeTab` state model (no routing
  change) and adding `searchQuery` state + scroll-to-row-on-search-result
  behavior.
- Mobile drawer variant: same visual language, nav becomes a horizontal
  scroller as today, with the search input placed above it (full width).

## Explicitly out of scope

- No change to which settings exist or what they do — pure presentation
  redesign plus the search feature described below.
- No new nav items beyond Zola's existing eight tabs (dropping Claude-only
  items: Account, Privacy, Billing, Capabilities, Claude Code, Claude in
  Chrome, Skills, Connectors, Plugins — none have a Zola equivalent).
- No changes to `components/ui/tabs.tsx`, `dialog.tsx`, or `drawer.tsx`
  primitives themselves — only how they're composed within the settings
  dialog.
- No test suite work — per `CLAUDE.md` this repo has no test runner
  configured. Verification is `npm run lint`, `npm run type-check`, and a
  manual dev-server visual comparison against the reference screenshot.

## Search behavior

Empty query: sidebar shows the normal two-group nav list (Settings /
Customize), as designed above.

Non-empty query: sidebar swaps to a flat list of matches from
`settings-search-index.ts`, fuzzy-matched (case-insensitive substring) against
each entry's `label`, `description`, and parent tab name. Each result shows
its label and a small "in {Tab Name}" hint. Clicking a result:
1. `setActiveTab(result.tab)`
2. On next render, `document.getElementById(result.rowId)?.scrollIntoView({ block: "center" })`
3. Briefly apply a highlight-pulse class to the row, then remove it (CSS
   transition, no persistent state).

If a tab is Supabase-gated (`usage`, `budget`) and Supabase is disabled, its
index entries are excluded from search results (same gating already applied
to the nav list).

## Visual/token approach

Add new CSS custom properties in both `:root` and `.dark` blocks in
`app/globals.css`, plus corresponding `@theme` entries so they're usable as
Tailwind utility classes (`bg-surface-1`, `border-alpha-2`, etc.), matching
the reference markup's class names exactly where practical. These are new,
additive tokens — they do not replace or alias existing shadcn tokens used
elsewhere in the app.

## Risks / open questions for implementation planning

- Exact token color values (the reference screenshot is dark-theme only) need
  reasonable light-mode equivalents chosen during implementation, following
  the same relationships as the dark set (e.g. `surface-2` slightly
  distinguished from `surface-1`, `alpha-2` a stronger tint than `alpha-1`) —
  not specified pixel-for-pixel in this spec.
