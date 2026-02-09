

# Fix: Draft Response Panel - Full Scrollable Side Sheet

## The Problem

When the AI responds in the TopBar command bar, the response appears in a small dropdown panel (max 300px height). Long responses get cut off with no visible scrollbar.

## Best Practice Decision

After analyzing how top platforms handle this:

| Platform | Pattern |
|----------|---------|
| ChatGPT | Full-page chat view |
| Notion AI | Inline expanding panel |
| Linear | Side sheet / drawer |
| Slack | Thread panel on the right |
| Spotlight (macOS) | Expanding dropdown |

**Recommended approach: Side Sheet (Drawer)**

A slide-in panel from the right side that:
- Shows the full AI response with proper scrolling
- Stays open while the user reads and interacts
- Has Confirm / Edit buttons at the bottom (sticky)
- Can be dismissed with Escape or X button
- Does NOT navigate away from the current page
- Feels like a conversation, not a page transition

This is better than opening a new page because:
- User keeps context of where they are (Today, Goals, etc.)
- Quick dismiss -- no navigation needed
- Feels lightweight and fast
- Matches the "one brain, one input" philosophy

## Implementation

### Changes to `src/components/brain/BrainCommandBar.tsx`

Replace the `absolute` dropdown panel with a `Sheet` component (from Radix/shadcn) that slides from the right:

1. Remove the absolute positioned dropdown div (lines 96-141)
2. Use the existing `Sheet` component from `src/components/ui/sheet.tsx`
3. Sheet opens when `showDraft` is true
4. Content inside the sheet:
   - Header: "Draft Preview" with close button
   - Body: Full `ScrollArea` taking available height with the AI response rendered via ReactMarkdown
   - Footer (sticky): Confirm and Edit buttons
5. Increase content area to use `h-full` instead of `max-h-[300px]`

### Sheet Configuration
- Side: `right`
- Width: `w-[480px]` on desktop, full width on mobile
- The AI response will have unlimited scroll within the sheet body
- Sticky footer with action buttons always visible

### Files Modified
- `src/components/brain/BrainCommandBar.tsx` -- replace dropdown with Sheet

### No Other Files Needed
The `Sheet` component already exists in the project at `src/components/ui/sheet.tsx`. No new dependencies required.

## Technical Details

```text
┌──────────────────────────────────┬────────────────────┐
│                                  │  DRAFT PREVIEW   X │
│     Current Page                 │                    │
│     (Today / Goals / etc.)       │  AI Response here  │
│                                  │  with full scroll  │
│                                  │  ...               │
│                                  │  ...               │
│                                  │  ...               │
│                                  ├────────────────────┤
│                                  │ [Confirm]  [Edit]  │
└──────────────────────────────────┴────────────────────┘
```

- The Sheet is controlled by `showDraft` state (already exists in BrainCommandContext)
- Escape key already handled -- Sheet component handles it natively
- The input bar stays in the TopBar -- only the response moves to the Sheet
