

# Unified Language Settings — Single Flow, No Duplication

## Problem
The current `/settings/language` page has two separate language pickers that confuse users:
1. **UI Language** section (EN / AR / FR) with enable/disable toggles
2. **Content Language (ULL Projection)** section with 30+ world languages

This feels like picking a language twice. The user wants one clear flow.

## Proposed Design (Best Practice)

Restructure the page into a single, intuitive flow:

```text
+--------------------------------------------------+
|  Language Settings                          [ULL] |
|  Choose your language preferences                 |
+--------------------------------------------------+
|                                                   |
|  YOUR LANGUAGE                                    |
|  "Select the language you want to work in"        |
|                                                   |
|  [Search languages...]                            |
|  +----------------------------------------------+ |
|  | EN  English           English                | |
|  | AR  Arabic            العربية          [✓]   | |
|  | FR  French            Français               | |
|  | ES  Spanish           Español                | |
|  | HI  Hindi             हिन्दी                  | |
|  | UR  Urdu              اردو                    | |
|  | ... (all 30 languages)                       | |
|  +----------------------------------------------+ |
|  Selected: العربية (ar)                           |
|                                                   |
+--------------------------------------------------+
|                                                   |
|  INTERFACE LANGUAGE (optional)                    |
|  "Buttons and menus can display in:"              |
|                                                   |
|  [English] [العربية ✓] [Français]                 |
|                                                   |
|  Hint: If your language above is EN/AR/FR,        |
|  this is set automatically.                       |
|                                                   |
+--------------------------------------------------+
|                                                   |
|  ULL Status   [System]                            |
|  ... (existing status panel, unchanged)           |
|                                                   |
+--------------------------------------------------+
```

### How it works:

1. **Step 1 — "Your Language"**: User picks any language from the full world languages list. This sets `content_locale` (ULL projection target). All AI content, Brain responses, tasks, goals, chat translations render in this language.

2. **Step 2 — "Interface Language"**: A small secondary section shows 3 buttons (EN / AR / FR). This sets `preferred_locale` (i18n UI strings). If the user chose AR, FR, or EN in step 1, the interface language auto-matches and this section can be collapsed or hidden.

3. **ULL Status**: Remains at the bottom, unchanged.

### Key behavior:
- If user picks "Urdu" as their language, content renders in Urdu via ULL, and interface stays in the closest supported UI language (or their manual choice of EN/AR/FR)
- If user picks "Arabic", both content AND interface switch to Arabic automatically
- The "enable/disable multiple languages" toggle system is removed (it was confusing and rarely used)

## Technical Changes

### File: `src/pages/settings/LanguageSettingsPage.tsx`
- Remove the "Enabled Languages" toggle list and "Active Language Selection" section
- Replace with the `ContentLanguagePicker` as the PRIMARY picker (Step 1)
- Add a compact "Interface Language" row with 3 buttons below (Step 2)
- Auto-set `preferred_locale` when user picks EN/AR/FR as content language
- Keep ULL Status panel and Developer Contract link as-is

### File: `src/contexts/LanguageContext.tsx`
- Simplify: remove `enabledLanguages`, `toggleLanguage`, `cycleLanguage` (unused complexity)
- Keep `currentLanguage` (UI), `contentLocale` (ULL), `setCurrentLanguage`, `setContentLocale`
- When `setContentLocale` is called with 'en'/'ar'/'fr', auto-sync `currentLanguage` to match

### Files: `src/i18n/translations/{en,ar,fr}.json`
- Update translation keys for new section labels ("Your Language", "Interface Language", etc.)

### Files to check for removed API usage:
- `src/components/TopBar.tsx` — may reference `cycleLanguage` or `enabledLanguages`
- Any component importing `toggleLanguage` or `enabledLanguages` from `useLanguage()`

### No changes needed:
- `ContentLanguagePicker.tsx` — already has the right UX (search + full list)
- `useULL.ts` — already reads `contentLocale` correctly
- `WorkspaceLanguageSettingsPage.tsx` — stays separate (admin-level workspace default)
- Edge functions — no changes needed
- Database schema — no changes needed

