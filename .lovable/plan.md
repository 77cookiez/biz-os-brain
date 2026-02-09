
# UI Overhaul: Business Brain Experience

## Summary

This plan addresses 8 improvement areas to transform AiBizos from a prototype feel into a polished, production-grade AI Business OS. The core philosophy: **one brain, one input, one dashboard**.

---

## 1. Rename "AI Brain" to "Business Brain"

**Changes:**
- Sidebar section label: "AI BRAIN" becomes "BUSINESS BRAIN"
- TopBar input placeholder: "Ask Business Brain anything..."
- Chat panel empty state: "Business Brain"
- All translation files (en, ar, fr) updated accordingly
- Edge function system prompt references stay as "AI Business Brain" (internal only)

**Files:** `en.json`, `ar.json`, `fr.json`, `ChatPanel.tsx`

---

## 2. TopBar Input Becomes a Real AI Input

The current TopBar "search bar" is just a clickable div that navigates to `/`. It will become a **real input field** with the full draft-preview-confirm workflow.

**Behavior:**
- User types directly in the TopBar input
- On Enter or Send button click, the system calls the brain-chat edge function
- Response appears in a **slide-down panel** (or dialog) below the TopBar
- The response is treated as a **draft** with two action buttons: **Confirm** and **Edit**
- Pressing Confirm saves the plan/task/goal; Edit lets the user modify the request
- The panel can be dismissed

**Implementation:**
- Replace the clickable `div` in TopBar with a real `input` element + Send button
- Add a new `BrainCommandBar` component that manages:
  - Input state
  - Calling `useBrainChat` hook
  - Displaying the AI response in a dropdown/sheet panel
  - Confirm/Edit buttons on the response
- Use Cmd+K / Ctrl+K keyboard shortcut to focus the input (already hinted in UI)

**Files:** `TopBar.tsx` (major rewrite of input section), new `src/components/brain/BrainCommandBar.tsx`

---

## 3. Remove Duplicate Input from TodayPage

The large AI input box + hero section (brain icon, greeting, "What would you like to work on?") will be removed from TodayPage. The greeting can stay as a small contextual header.

**What gets removed:**
- The hero section with Brain icon and greeting (lines 117-128)
- The large AI input box (lines 130-147)
- The `showChat` state and full ChatPanel view (lines 97-112)
- All imports related to chat functionality (`useBrainChat`, `ChatPanel`, `ReactMarkdown`)

**What stays:**
- A small greeting line at the top
- Suggestion cards (modified -- see point 5)
- Task sections (priority, overdue, upcoming)
- Action buttons (Add Task, Ask Brain to Plan)

**Files:** `TodayPage.tsx`

---

## 4. Redesign TodayPage as a Real Daily Dashboard

The page becomes a focused work dashboard:

```text
┌─────────────────────────────────────────┐
│  Good morning, [Name]                   │
│  [+ Add Task]  [Ask Brain to Plan]      │
├─────────────────────────────────────────┤
│  TOP 3 PRIORITIES                       │
│  1. Task A                              │
│  2. Task B                              │
│  3. Task C                              │
├─────────────────────────────────────────┤
│  OVERDUE (if any)                       │
│  ! Task D - was due Feb 5               │
├─────────────────────────────────────────┤
│  THIS WEEK                              │
│  - Task E (Wed)                         │
│  - Task F (Fri)                         │
├─────────────────────────────────────────┤
│  QUICK ACTIONS                          │
│  [Set goals] [Review week] [Marketing]  │
└─────────────────────────────────────────┘
```

**Key additions:**
- "Add Task" button -- opens a simple inline form or dialog to manually create a task
- "Ask Brain to Plan" button -- focuses the TopBar command bar input with a pre-filled prompt
- Suggestion cards move to the bottom as "Quick Actions"
- Greeting becomes compact (one line, no icon)

**Files:** `TodayPage.tsx` (major rewrite)

---

## 5. Suggestion Cards Generate Drafts (Not Direct Execution)

Currently, clicking a suggestion immediately sends a chat message. Instead:

- Clicking a suggestion card will **focus the TopBar command bar** and pre-fill the text
- The user can edit or press Enter to send
- The AI response appears as a **draft** with Confirm/Edit buttons
- Nothing is executed until the user confirms

This is handled by the new `BrainCommandBar` component which will expose a method to set input text programmatically (via React context or ref).

**Files:** `BrainCommandBar.tsx`, `TodayPage.tsx`

---

## 6. Sidebar: Show Only Active Apps

Currently the sidebar shows ALL apps from `app_registry` including inactive and "coming soon" ones. 

**Change:**
- Filter to show only apps where `isAppActive(app.id)` returns true
- Remove the "off" and "soon" badges entirely
- Inactive/coming-soon apps are only visible in the Marketplace page

**Files:** `AppSidebar.tsx`

---

## 7. Subtle Badge Styling

The "off" and "soon" badges are being removed from the sidebar (point 6), but if any badges remain elsewhere in the app, they will use a more subtle style -- smaller text, lower opacity, no background pill.

**Files:** `AppSidebar.tsx`

---

## 8. Company Dropdown: Add Team Management Links

The company/workspace dropdown in the TopBar will be expanded with team management shortcuts:

**New items in dropdown:**
- "Team" -- navigates to `/settings/team`
- "Invitations" -- navigates to `/settings/team` (same page, invitation section)
- "Roles" -- navigates to `/settings/team`
- "Switch Workspace" section (already exists)

**Structure:**
```text
Companies
  - Company A
  - Company B
---
Workspaces
  - Workspace 1
  - Workspace 2
  + New Workspace
---
Team & Roles
Switch Workspace
```

**Files:** `TopBar.tsx`

---

## Technical Details

### New Components

| Component | Purpose |
|-----------|---------|
| `src/components/brain/BrainCommandBar.tsx` | Global AI input with draft preview, confirm/edit flow |
| `src/contexts/BrainCommandContext.tsx` | Context to allow any component to trigger the command bar |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/TopBar.tsx` | Replace fake input with BrainCommandBar, add team links to dropdown |
| `src/pages/brain/TodayPage.tsx` | Remove hero/input/chat, add action buttons, reorder sections |
| `src/components/AppSidebar.tsx` | Filter to active apps only, remove badges |
| `src/components/brain/ChatPanel.tsx` | Update "AI Brain" references to "Business Brain" |
| `src/i18n/translations/en.json` | Update all naming references + new keys |
| `src/i18n/translations/ar.json` | Same |
| `src/i18n/translations/fr.json` | Same |
| `src/App.tsx` | Wrap with BrainCommandContext |
| `src/components/OSLayout.tsx` | No changes needed (TopBar already included) |

### Draft-Preview-Confirm Flow

The BrainCommandBar will implement the execution gate pattern:
1. User types request
2. AI generates a structured draft (plan/task/goal)
3. Draft is displayed in a Sheet/popover panel with Confirm and Edit buttons
4. On Confirm: data is written to the database (tasks table, goals table, etc.)
5. On Edit: user modifies the request and re-submits

### Keyboard Shortcut
- Cmd+K (Mac) / Ctrl+K (Windows) will focus the command bar input
- Escape will close the draft panel

### Translation Keys Added
- `topbar.askBrain`: "Ask Business Brain anything..."
- `today.addTask`: "Add Task"
- `today.askBrainToPlan`: "Ask Brain to Plan"
- `today.quickActions`: "Quick Actions"
- `today.topPriorities`: "Top 3 Priorities"
- `today.overdue`: "Overdue"
- `today.thisWeek`: "This Week"
- `brain.confirm`: "Confirm"
- `brain.editDraft`: "Edit"
- `brain.draftTitle`: "Draft Preview"
- `navigation.businessBrain`: "BUSINESS BRAIN"
- `topbar.teamRoles`: "Team & Roles"
