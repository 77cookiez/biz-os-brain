

# Fix: Brain 404 + Language Persistence

## Issue 1: Brain 404 in Apps Section

**Root Cause:** The "brain" app is registered in `app_registry` and installed in `workspace_apps`. The sidebar renders installed apps under the "Apps" section with links to `/apps/{app_id}`, so Brain gets a link to `/apps/brain`. But the actual route is `/brain`, not `/apps/brain`.

**Fix:** Add `brain` to the `SYSTEM_APP_IDS` list in `systemApps.ts` (or at minimum to the sidebar filter). Since Brain is already shown in the primary "Business Brain" section of the sidebar, it should be excluded from the "Apps" section just like ULL is. Adding `brain` to `SYSTEM_APP_IDS` will:
- Filter it out from the dynamic Apps nav section (line 40 already filters system apps)
- Prevent it from being uninstalled/deactivated in settings
- It already has a dedicated link at `/brain` in the `brainLinks` array

**File:** `src/lib/systemApps.ts`
- Change `SYSTEM_APP_IDS` from `['ull']` to `['ull', 'brain']`

---

## Issue 2: Language Resets to Arabic

**Root Cause:** The user's profile in the database has `preferred_locale: 'ar'`. The `LanguageProvider` loads from the DB profile on every mount, and DB takes priority over localStorage. So even if the user switches to English via the UI (which saves to localStorage), on next navigation/remount the DB value (`ar`) overrides it.

The `setCurrentLanguage` function only saves to localStorage but never updates the DB profile. So the DB always wins.

**Fix:** Update `setCurrentLanguage` in `LanguageContext.tsx` to also persist to the `profiles` table:

```typescript
const setCurrentLanguage = async (lang: Language) => {
  setCurrentLanguageState(lang);
  localStorage.setItem(STORAGE_KEY_CURRENT, lang.code);
  
  // Also persist to DB profile
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ preferred_locale: lang.code })
      .eq('user_id', user.id);
  }
};
```

**File:** `src/contexts/LanguageContext.tsx`
- Update the `setCurrentLanguage` function to sync with the database

---

## Summary

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| Brain 404 | Sidebar links to `/apps/brain`, route is `/brain` | Add `brain` to `SYSTEM_APP_IDS` so it's excluded from Apps section |
| Language resets | DB `preferred_locale` overrides localStorage on every mount | Sync language changes to DB in `setCurrentLanguage` |

Both fixes are small, targeted changes -- one line in `systemApps.ts` and a few lines in `LanguageContext.tsx`.
