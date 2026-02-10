

# Brain AI UX Overhaul — Typography, Command Bar Full-Page, and Bug Fixes

## Problems Identified

1. **Poor typography in AI responses**: The markdown rendering uses `prose-sm` with inconsistent color overrides. No proper font stack for Arabic/English. Text appears cramped, bold, and hard to read.

2. **Command Bar (Cmd+K) Draft Sheet is ugly and limited**: Opens a narrow side drawer (480px) with raw markdown, no conversation flow. One-shot only — no back-and-forth discussion.

3. **"Send to Workboard" causes 404 error**: Both `BrainPage` and `BrainCommandBar` navigate to `/apps/workboard/today` which does not exist. The correct route is `/apps/workboard` (index route renders WorkboardTodayPage) or `/apps/workboard/backlog`.

4. **No professional font loaded**: The app uses system defaults with no explicit font import. ChatGPT uses Inter/system fonts with carefully tuned sizes and line-heights.

## Plan

### 1. Add Professional Font Stack (Inter + Noto Sans Arabic)

**index.html**: Add Google Fonts link for Inter (Latin) and Noto Sans Arabic.

**tailwind.config.ts**: Set `fontFamily.sans` to `['Inter', 'Noto Sans Arabic', ...system]`.

**src/index.css**: Apply `font-feature-settings: 'cv02', 'cv03', 'cv04'` for Inter ligatures. Set base `line-height: 1.6` for readability.

### 2. Fix Markdown Typography (ChatGPT-quality rendering)

**src/pages/brain/BrainPage.tsx** (assistant message bubble):
- Remove `prose-sm`, use `prose` (base size)
- Add proper color mapping: `prose-neutral dark:prose-invert`
- Set `leading-relaxed` for comfortable line spacing
- Style lists with proper spacing, headings with clear hierarchy
- Ensure Arabic text renders with correct `dir="auto"`

**src/components/brain/ChatPanel.tsx**: Same typography fix (remove `prose-invert`, add proper theme-aware classes).

**src/components/brain/BrainCommandBar.tsx**: Same fix in the Sheet's markdown section.

### 3. Transform Command Bar from Side-Sheet to Full Conversation Page

Instead of the narrow `Sheet` drawer, Cmd+K will:
- Still capture input in the TopBar (quick entry stays)
- On submit, **navigate to `/brain`** with the message pre-filled
- The `/brain` page already has full ChatGPT-style conversation with streaming, voice, suggestions, and decision panel
- This eliminates the duplicate chat logic in BrainCommandBar and makes the experience consistent

**src/components/brain/BrainCommandBar.tsx**:
- Remove the `Sheet` / `SheetContent` entirely
- On send: navigate to `/brain` and pass the message via context (`prefillAndFocus` or a new `pendingMessage` state)
- The BrainCommandBar becomes a lightweight input-only component

**src/contexts/BrainCommandContext.tsx**:
- Add `pendingMessage` state so BrainPage can pick it up and auto-send on mount

**src/pages/brain/BrainPage.tsx**:
- On mount, check for `pendingMessage` from context, auto-send it, then clear

### 4. Fix Navigation Route Bug

**src/pages/brain/BrainPage.tsx** (line ~308): Change `navigate('/apps/workboard/backlog')` to `navigate('/apps/workboard/backlog')` (this one is already correct).

**src/components/brain/BrainCommandBar.tsx** (lines ~165, ~229): Change `navigate('/apps/workboard/today')` to `navigate('/apps/workboard')` — the index route is the Today page.

### 5. Clean Up AI Response Display

- Strip `ULL_MEANING_V1` blocks before rendering (already done in BrainPage, needs adding in BrainCommandBar)
- Add subtle separator between response text and Decision Panel
- Decision Panel buttons: clearer labels, better spacing

---

## Technical Details

### Files to modify:
1. **index.html** — Add Inter + Noto Sans Arabic font imports
2. **tailwind.config.ts** — Add `fontFamily.sans`
3. **src/index.css** — Base typography refinements
4. **src/components/brain/BrainCommandBar.tsx** — Remove Sheet, navigate to /brain on send
5. **src/contexts/BrainCommandContext.tsx** — Add `pendingMessage` state
6. **src/pages/brain/BrainPage.tsx** — Fix typography, consume `pendingMessage`, fix route
7. **src/components/brain/ChatPanel.tsx** — Fix typography classes

### No changes to:
- Edge functions
- Database schema
- Chat/Tasks/Goals flows
- ULL system

