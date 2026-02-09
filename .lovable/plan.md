# ULL Implementation Status

## ✅ Phase 0 — Transitional Compatibility (DONE)
- `source_lang` columns added to all content tables
- `content_translations` cache table created
- `ull-translate` edge function (text-based)
- `useULL` hook + `ULLText` component
- Brain responds in user's language
- i18n keys for static UI strings

## ✅ Phase 1 — Meaning-First Enforcement (DONE)
- `meaning_objects` table = canonical truth
- `src/lib/meaningObject.ts` — create/update + zod validation (MeaningJsonV1)
- All write paths create meaning objects first:
  - Tasks (create + lazy migration on update)
  - Goals (WorkboardGoalsPage + GoalsPage)
  - Ideas (manual + AI brainstorm)
- `ULLText` supports `meaningId` prop (Phase 1 primary)
- `useULL` has `getTextByMeaning()` with batched requests
- `ull-translate` accepts `meaning_object_ids` for meaning→language projection
- Brain outputs `ULL_MEANING_V1` structured blocks
- `BrainCommandBar` extracts meaning blocks → creates meaning objects → tasks
- Unique constraint on `content_translations(meaning_object_id, target_lang, field)`

## ⬜ Phase 2 — Full Projection (NEXT)
- All UI reads via meaningId (remove legacy table/id/field paths)
- ✅ Plans module meaning-first
- ✅ Brain messages stored with meaning_object_id
- Background lazy migration for old records
