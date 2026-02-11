
# Top Bar Language Button + Settings Page — Best Practice Redesign

## Current Problems
1. The Globe button in the top bar navigates to `/settings/language` — feels like a dead-end click with no immediate feedback
2. The settings page has two sections ("Your Language" + "Interface Language") which feels like choosing a language twice
3. No quick-access language switching from the top bar

## Global Best Practice (What major apps do)

Apps like Google, Twitter/X, Notion, and Slack follow a common pattern:
- **Top bar**: A small dropdown that lets you quickly switch language right there (no navigation away)
- **Settings page**: Full language preferences with explanations (for users who want more control)

Our case is special because we have TWO language concepts (content language via ULL + UI language). The best approach is to **hide this complexity** from the user.

## Proposed Design

### Top Bar: Quick Language Dropdown (not a navigation link)

Instead of navigating to settings, the Globe button opens a small dropdown right there:

```text
  [Globe AR v]
       |
       +---------------------------+
       |  Your Language             |
       |                           |
       |  * العربية  (Arabic)  [✓] |
       |    English                |
       |    Français               |
       |    Español                |
       |    Deutsch                |
       |    More languages...      |
       |                           |
       |  [Language Settings ->]   |
       +---------------------------+
```

- Shows the top 5 UI-supported languages for quick switching
- "More languages..." opens the full ContentLanguagePicker in settings
- "Language Settings" link at the bottom for advanced options
- Selecting a language instantly changes BOTH content locale AND interface language (for the 5 supported ones)
- This gives immediate feedback — the user clicks, the UI changes, done

### Settings Page: Simplified Single Section

Merge the two sections into ONE clean flow:

```text
+--------------------------------------------------+
|  Language Settings                          [ULL] |
+--------------------------------------------------+
|                                                   |
|  YOUR LANGUAGE                                    |
|  "Choose the language for your entire experience" |
|                                                   |
|  [Search languages...]                            |
|  | English                                      | |
|  | العربية (Arabic)                        [✓]  | |
|  | Français (French)                            | |
|  | Español (Spanish)                            | |
|  | Deutsch (German)                             | |
|  | हिन्दी (Hindi)                                | |
|  | ... (30 languages)                           | |
|                                                   |
|  Note: If you choose a language other than       |
|  English, Arabic, French, Spanish, or German,    |
|  all AI content will appear in your language,    |
|  while buttons and menus will display in the     |
|  closest supported language.                     |
|                                                   |
+--------------------------------------------------+
|  ULL Status (system panel, unchanged)            |
+--------------------------------------------------+
```

- Remove the separate "Interface Language" section entirely
- The auto-sync logic already handles it: picking EN/AR/FR/ES/DE sets both; picking any other language sets content locale only and keeps the current UI language
- One explanatory note replaces the confusing two-step process

## Technical Changes

### 1. `src/components/TopBar.tsx`
- Replace the plain Globe button (which navigates to settings) with a `DropdownMenu`
- Show 5 supported languages as quick-switch options
- Add "More languages..." item that navigates to `/settings/language`
- Add "Language Settings" link at the bottom
- Clicking a language calls `setContentLocale(code)` which auto-syncs UI language via existing logic

### 2. `src/pages/settings/LanguageSettingsPage.tsx`
- Remove the entire "Interface Language" section (Step 2 card with the 5 buttons)
- Keep only the "Your Language" ContentLanguagePicker as the single primary picker
- Add an explanatory note below the picker about how interface language is handled automatically
- Keep ULL Status panel and Developer Contract link unchanged

### 3. `src/i18n/translations/{en,ar,fr,es,de}.json`
- Update/add keys for the new explanatory note
- Remove unused `interfaceLanguage`, `interfaceLanguageDesc`, `interfaceLanguageHint`, `optional` keys

### No changes needed:
- `LanguageContext.tsx` — auto-sync logic already works correctly
- `ContentLanguagePicker.tsx` — already has the right UX
- Edge functions, database — no changes
